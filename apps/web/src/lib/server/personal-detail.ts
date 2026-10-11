import {
	choreCompletions,
	choreStageProgress,
	choreStages,
	householdMembers,
} from '@chore/db';
import { chorePeriodStart } from '@chore/db/recurrence';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { effectiveAssignee, type PersonalDetail } from '../personal-detail.ts';
import { stageStates } from '../rotation-detail.ts';
import { db } from './drizzle.ts';
import { householdToday } from './household-today.ts';
import type { ProfileState } from './profile-state.ts';
import {
	ensureInstance,
	findInstance,
	loadChore,
	sqlState,
	UUID,
} from './rotation-detail.ts';

// Reads and writes for the personal chore screen (SB-40). As with the other
// web-side modules, the web app talks to Postgres as the table owner, so RLS
// doesn't apply: every query is scoped by the caller's household, and only the
// member the chore is assigned to can complete it (a parent who can act as a
// managed kid does so through that kid's profile).
//
// Completing goes through the SB-26 functions, which write the stage, the
// completion and the points in one transaction and lock the chore instance, so
// two taps or two devices can't both award. Repeating a call is a no-op that
// returns the existing completion, which is also what makes a refresh or a
// double-tap safe: the celebration screen (SB-42) only ever reads.

/** A problem with the request, worded for the screen. */
export class PersonalDetailError extends Error {
	readonly status: 400 | 403 | 404 | 409;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 403 | 404 | 409 = 400) {
		super(message);
		this.name = 'PersonalDetailError';
		this.status = status;
	}
}

type Chore = NonNullable<Awaited<ReturnType<typeof loadChore>>>;

interface PersonalState {
	chore: Chore;
	periodStart: string | null;
	/** The open completion for this period, if any. */
	completionId: string | null;
	doneStageIds: Set<string>;
	stages: { id: string; title: string; hint: string | null }[];
	/** Who this period's chore belongs to right now. */
	assigneeId: string | null;
}

/** Everything the screen and the writes need about one personal chore today. */
async function loadState(
	chore: Chore,
	now: Date = new Date(),
): Promise<PersonalState> {
	const periodStart = chorePeriodStart(
		chore.frequency,
		await householdToday(chore.householdId, now),
	);
	const instance = periodStart
		? await findInstance(chore.id, periodStart)
		: null;

	const stages = await db
		.select({
			id: choreStages.id,
			title: choreStages.title,
			hint: choreStages.hint,
		})
		.from(choreStages)
		.where(eq(choreStages.choreId, chore.id))
		.orderBy(asc(choreStages.position));

	let completionId: string | null = null;
	let doneStageIds = new Set<string>();
	if (instance) {
		const [completion] = await db
			.select({ id: choreCompletions.id })
			.from(choreCompletions)
			.where(
				and(
					eq(choreCompletions.instanceId, instance.id),
					isNull(choreCompletions.reopenedAt),
				),
			);
		completionId = completion?.id ?? null;
		const progress = await db
			.select({ stageId: choreStageProgress.stageId })
			.from(choreStageProgress)
			.where(eq(choreStageProgress.instanceId, instance.id));
		doneStageIds = new Set(progress.map((p) => p.stageId));
	}
	const assigneeId = effectiveAssignee({
		choreAssigneeId: chore.assignedMemberId,
		instanceAssigneeId: instance?.assignedMemberId ?? null,
		touched: completionId !== null || doneStageIds.size > 0,
	});
	return { chore, periodStart, completionId, doneStageIds, stages, assigneeId };
}

/**
 * The screen for a personal chore, as seen by `viewer`. Returns `undefined`
 * when the chore isn't in the viewer's household, and `null` when it exists but
 * isn't a personal chore (the rotation screen handles those).
 */
export async function loadPersonalDetail(
	viewer: { id: string; householdId: string },
	choreId: string,
	now: Date = new Date(),
): Promise<PersonalDetail | null | undefined> {
	const chore = await loadChore(viewer.householdId, choreId);
	if (!chore) return undefined;
	if (chore.type !== 'personal') return null;
	const state = await loadState(chore, now);

	const completed = state.completionId !== null;
	let assigneeName: string | null = null;
	if (state.assigneeId) {
		const [assignee] = await db
			.select({ name: householdMembers.displayName })
			.from(householdMembers)
			.where(
				and(
					eq(householdMembers.id, state.assigneeId),
					eq(householdMembers.householdId, viewer.householdId),
				),
			);
		assigneeName = assignee?.name ?? null;
	}
	const isAssignee = state.assigneeId === viewer.id;
	const availableToday = state.periodStart !== null;
	const doneIds = completed
		? new Set(state.stages.map((s) => s.id))
		: state.doneStageIds;
	return {
		choreId,
		title: chore.title,
		description: chore.description,
		points: chore.points,
		assigneeName,
		isAssignee,
		completedThisPeriod: completed,
		availableToday,
		canComplete: isAssignee && availableToday && !completed,
		stages: stageStates(state.stages, doneIds),
	};
}

export interface StepResult {
	/** The completion once the chore is done (this call or an earlier one); null while stages remain. */
	completionId: string | null;
	/** Points awarded by this call. 0 for a repeat. */
	points: number;
	choreCompleted: boolean;
}

/**
 * Checks off a stage of a staged chore (`stageId`), or completes a chore that
 * has no stages (`stageId` null). The last stage completes the chore in the
 * same transaction. Only the chore's assignee may do it.
 *
 * Repeating a call changes nothing: checking a done stage is a no-op, and once
 * the chore is complete this returns the existing completion with 0 points, so
 * the caller can still send the member to the celebration screen.
 */
export async function completePersonalStep(
	state: ProfileState,
	choreId: string,
	stageId: string | null,
	now: Date = new Date(),
): Promise<StepResult> {
	if (!UUID.test(choreId)) {
		throw new PersonalDetailError('That chore was not found.', 404);
	}
	if (stageId !== null && !UUID.test(stageId)) {
		throw new PersonalDetailError('That stage was not found.', 404);
	}
	const householdId = state.member.householdId;
	const chore = await loadChore(householdId, choreId);
	if (chore?.type !== 'personal') {
		throw new PersonalDetailError('That chore was not found.', 404);
	}
	const loaded = await loadState(chore, now);
	const { assigneeId, periodStart } = loaded;

	if (!assigneeId) {
		throw new PersonalDetailError('Nobody is assigned to this chore yet.', 409);
	}
	if (assigneeId !== state.member.id) {
		throw new PersonalDetailError(
			'Only the person this chore is assigned to can complete it.',
			403,
		);
	}
	if (loaded.completionId) {
		return {
			completionId: loaded.completionId,
			points: 0,
			choreCompleted: true,
		};
	}
	if (!periodStart) {
		throw new PersonalDetailError("This chore isn't due today.", 409);
	}
	const staged = loaded.stages.length > 0;
	if (staged) {
		if (stageId === null) {
			throw new PersonalDetailError('Choose a stage to check off.', 400);
		}
		if (!loaded.stages.some((s) => s.id === stageId)) {
			throw new PersonalDetailError('That stage was not found.', 404);
		}
	}
	// The signed-in account (the parent, while a kid profile is active) is who
	// the database authorizes; it may act as the kid.
	const userId = state.actor.userId;
	if (!userId) throw new PersonalDetailError('Sign in again to continue.', 403);
	const instance = await ensureInstance(
		householdId,
		choreId,
		periodStart,
		assigneeId,
	);
	const claims = JSON.stringify({ sub: userId });

	try {
		if (staged) {
			const [, stage] = await db.batch([
				db.execute(
					sql`select set_config('request.jwt.claims', ${claims}, true)`,
				),
				db.execute<{
					chore_completed: boolean;
					completion_id: string | null;
					points: number;
				}>(
					sql`select chore_completed, completion_id, points from app.complete_chore_stage(${instance.id}::uuid, ${stageId}::uuid)`,
				),
			]);
			const row = stage.rows[0];
			if (!row) throw new Error('complete_chore_stage returned no row');
			return {
				completionId: row.chore_completed ? row.completion_id : null,
				points: row.points,
				choreCompleted: row.chore_completed,
			};
		}
		const [, completed] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{ completion_id: string; points: number }>(
				sql`select completion_id, points from app.complete_chore_instance(${instance.id}::uuid)`,
			),
		]);
		const row = completed.rows[0];
		if (!row) throw new Error('complete_chore_instance returned no row');
		return {
			completionId: row.completion_id,
			points: row.points,
			choreCompleted: true,
		};
	} catch (err) {
		throw mapError(err);
	}
}

/** Turns the database's custom errors into messages for the screen. */
function mapError(err: unknown): unknown {
	switch (sqlState(err)) {
		case 'P0002':
			return new PersonalDetailError('That chore was not found.', 404);
		case 'CP001':
			return new PersonalDetailError('Finish the earlier stages first.', 409);
		case 'CP002':
			return new PersonalDetailError('Finish every stage first.', 409);
		case 'CP003':
			return new PersonalDetailError(
				'Nobody is assigned to this chore yet.',
				409,
			);
		case '42501':
			return new PersonalDetailError(
				'Only the person this chore is assigned to can complete it.',
				403,
			);
		default:
			return err;
	}
}
