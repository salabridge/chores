import {
	choreCompletions,
	choreInstances,
	choreRotationMembers,
	choreRotations,
	choreStageProgress,
	choreStages,
	chores,
	householdMembers,
} from '@chore/db';
import { chorePeriodStart } from '@chore/db/recurrence';
import { rotationTurns } from '@chore/db/rotation';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
	type DetailDoer,
	type DetailMember,
	type RotationDetail,
	stageStates,
} from '../rotation-detail.ts';
import { scheduleLabel } from '../weekdays.ts';
import { db } from './drizzle.ts';
import { householdToday } from './household-today.ts';
import { isParentRole, type ProfileState } from './profile-state.ts';

// Reads and writes for the shared rotation chore screen (SB-41). As with the
// other web-side modules, the web app talks to Postgres as the table owner, so
// RLS doesn't apply: every query is scoped by the caller's household.
// Completing a turn is for the member whose turn it is, or for someone else in
// the household doing it for them (SB-74): they get the points, and the turn
// is used up as usual.
//
// Completing goes through the SB-26 functions (`app.complete_chore_instance`
// and `app.complete_chore_stage`), which write the completion, the points and
// the turn hand-off in one transaction. They authorize by `app.current_user_id()`,
// which reads the `request.jwt.claims` setting, so each call runs in a batch
// (one transaction on the HTTP driver) that sets the signed-in user first.

export const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A problem with the request, worded for the screen. */
export class RotationDetailError extends Error {
	readonly status: 400 | 403 | 404 | 409;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 403 | 404 | 409 = 400) {
		super(message);
		this.name = 'RotationDetailError';
		this.status = status;
	}
}

export async function loadChore(householdId: string, choreId: string) {
	if (!UUID.test(choreId)) return null;
	const [chore] = await db
		.select()
		.from(chores)
		.where(
			and(
				eq(chores.id, choreId),
				eq(chores.householdId, householdId),
				isNull(chores.archivedAt),
			),
		);
	return chore ?? null;
}

export async function loadRotation(householdId: string, choreId: string) {
	const [rotation] = await db
		.select()
		.from(choreRotations)
		.where(
			and(
				eq(choreRotations.choreId, choreId),
				eq(choreRotations.householdId, householdId),
			),
		);
	if (!rotation) return null;
	const members: DetailMember[] = await db
		.select({
			memberId: choreRotationMembers.memberId,
			position: choreRotationMembers.position,
			eligible: choreRotationMembers.eligible,
			exclusionReason: choreRotationMembers.exclusionReason,
			name: householdMembers.displayName,
		})
		.from(choreRotationMembers)
		.innerJoin(
			householdMembers,
			eq(householdMembers.id, choreRotationMembers.memberId),
		)
		.where(eq(choreRotationMembers.choreId, choreId))
		.orderBy(asc(choreRotationMembers.position));
	return { rotation, members };
}

/** A household member's display name, or null if they aren't in `householdId`. */
export async function householdMemberName(
	householdId: string,
	memberId: string,
): Promise<string | null> {
	const [member] = await db
		.select({ name: householdMembers.displayName })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.id, memberId),
				eq(householdMembers.householdId, householdId),
			),
		);
	return member?.name ?? null;
}

/** `{ memberId, name }` for a completion's doer, or null when there is none. */
export async function loadDoer(
	householdId: string,
	doneByMemberId: string | null | undefined,
): Promise<DetailDoer | null> {
	if (!doneByMemberId) return null;
	const name = await householdMemberName(householdId, doneByMemberId);
	return name ? { memberId: doneByMemberId, name } : null;
}

/**
 * Who did the chore, as the completion functions' `done_by` (SB-74): null when
 * it's the assignee (or turn-holder) themselves, so the database's own rule
 * applies unchanged.
 *
 * By default the doer is the acting profile (`state.member`: the signed-in
 * member, or the kid whose profile a parent has open). A parent in their own
 * view may instead name another member (`requested`), e.g. to record that a
 * managed kid did a sibling's chore; it must be someone in the household. The
 * database checks the same rules again.
 */
export async function resolveDoer(
	state: ProfileState,
	assigneeId: string,
	requested: string | null | undefined,
	fail: (message: string, status: 403 | 404) => Error,
): Promise<string | null> {
	const self = state.member.id;
	let doer = self;
	if (requested && requested !== self) {
		if (state.mode !== 'self' || !isParentRole(state.member.role)) {
			throw fail(
				'Only a parent can record that someone else did this chore.',
				403,
			);
		}
		const name = UUID.test(requested)
			? await householdMemberName(state.member.householdId, requested)
			: null;
		if (!name) throw fail('That member was not found.', 404);
		doer = requested;
	}
	return doer === assigneeId ? null : doer;
}

/** This period's instance, if anyone has touched the chore yet. */
export async function findInstance(choreId: string, periodStart: string) {
	const [instance] = await db
		.select()
		.from(choreInstances)
		.where(
			and(
				eq(choreInstances.choreId, choreId),
				eq(choreInstances.periodStart, periodStart),
			),
		);
	return instance ?? null;
}

/**
 * The screen for a rotation chore, as seen by `viewer`. Returns `undefined`
 * when the chore isn't in the viewer's household, and `null` when it exists
 * but isn't a rotation (the personal chore screen handles those).
 */
export async function loadRotationDetail(
	viewer: { id: string; householdId: string },
	choreId: string,
	now: Date = new Date(),
): Promise<RotationDetail | null | undefined> {
	const chore = await loadChore(viewer.householdId, choreId);
	if (!chore) return undefined;
	if (chore.type !== 'rotation') return null;
	const loaded = await loadRotation(viewer.householdId, choreId);
	if (!loaded) return undefined;
	const { rotation, members } = loaded;

	const turns = rotationTurns(
		members,
		rotation.currentMemberId,
		rotation.lastCompletedMemberId,
	);
	const periodStart = chorePeriodStart(
		chore.frequency,
		await householdToday(viewer.householdId, now),
	);
	const instance = periodStart
		? await findInstance(choreId, periodStart)
		: null;

	const stageRows = await db
		.select({
			id: choreStages.id,
			title: choreStages.title,
			hint: choreStages.hint,
		})
		.from(choreStages)
		.where(eq(choreStages.choreId, choreId))
		.orderBy(asc(choreStages.position));

	let completed = false;
	let doneBy: DetailDoer | null = null;
	let doneStageIds = new Set<string>();
	if (instance) {
		const [completion] = await db
			.select({
				id: choreCompletions.id,
				doneByMemberId: choreCompletions.doneByMemberId,
			})
			.from(choreCompletions)
			.where(
				and(
					eq(choreCompletions.instanceId, instance.id),
					isNull(choreCompletions.reopenedAt),
				),
			);
		completed = completion !== undefined;
		doneBy = await loadDoer(viewer.householdId, completion?.doneByMemberId);
		const progress = await db
			.select({ stageId: choreStageProgress.stageId })
			.from(choreStageProgress)
			.where(eq(choreStageProgress.instanceId, instance.id));
		doneStageIds = new Set(progress.map((p) => p.stageId));
	}
	if (completed) doneStageIds = new Set(stageRows.map((s) => s.id));

	const isMyTurn = turns.activeTurn?.memberId === viewer.id;
	const availableToday = periodStart !== null;
	const open = availableToday && !completed;
	return {
		choreId,
		title: chore.title,
		description: chore.description,
		points: chore.points,
		schedule: scheduleLabel(chore.frequency, chore.dueWeekday),
		scope: rotation.scope,
		scopeLabel: rotation.scopeLabel,
		members,
		doneLast: turns.doneLast,
		activeTurn: turns.activeTurn,
		nextUp: turns.nextUp,
		isMyTurn,
		completedThisPeriod: completed,
		doneBy,
		availableToday,
		canComplete: isMyTurn && open,
		canCompleteForTurnHolder: !isMyTurn && turns.activeTurn !== null && open,
		stages: stageStates(stageRows, doneStageIds),
	};
}

export interface TurnResult {
	/** The completion this call wrote or found; null while stages remain. */
	completionId: string | null;
	/** Points awarded by this call. */
	points: number;
	/** False when only a stage (not the last one) was checked off. */
	choreCompleted: boolean;
}

/**
 * Makes sure this period has an instance for the member whose turn it is, and
 * that an untouched one isn't left assigned to someone the turn has moved on
 * from (a parent's skip), which would make completing it fail.
 */
export async function ensureInstance(
	householdId: string,
	choreId: string,
	periodStart: string,
	turnHolderId: string,
) {
	await db
		.insert(choreInstances)
		.values({
			householdId,
			choreId,
			periodStart,
			assignedMemberId: turnHolderId,
		})
		.onConflictDoNothing({
			target: [choreInstances.choreId, choreInstances.periodStart],
		});
	const instance = await findInstance(choreId, periodStart);
	if (!instance) throw new Error('Could not open this chore for today.');
	if (instance.assignedMemberId !== turnHolderId) {
		await db.execute(sql`
			update chore_instances ci set assigned_member_id = ${turnHolderId}
			where ci.id = ${instance.id}
				and not exists (select 1 from chore_completions c where c.instance_id = ci.id)
				and not exists (select 1 from chore_stage_progress p where p.instance_id = ci.id)`);
		return (await findInstance(choreId, periodStart)) ?? instance;
	}
	return instance;
}

/**
 * Options for completing a turn. `doneBy` lets a parent in their own view
 * record that another household member did it (see `resolveDoer`); without
 * it, whoever is acting did it.
 */
export interface TurnOptions {
	doneBy?: string | null;
}

/**
 * Checks the chore is open now and works out who is doing it, and returns what
 * the write needs. The turn-holder completes their own turn; anyone else in
 * the household completing it does it for them (SB-74).
 */
async function prepare(
	state: ProfileState,
	choreId: string,
	options: TurnOptions,
) {
	const householdId = state.member.householdId;
	const chore = await loadChore(householdId, choreId);
	if (chore?.type !== 'rotation') {
		throw new RotationDetailError('That rotation chore was not found.', 404);
	}
	const loaded = await loadRotation(householdId, choreId);
	// Same derivation as the screen, so the check and the CTA can't drift.
	const turnHolderId = loaded
		? (rotationTurns(
				loaded.members,
				loaded.rotation.currentMemberId,
				loaded.rotation.lastCompletedMemberId,
			).activeTurn?.memberId ?? null)
		: null;
	if (!turnHolderId) {
		throw new RotationDetailError(
			'Nobody is eligible to take this turn yet.',
			409,
		);
	}
	const doneBy = await resolveDoer(
		state,
		turnHolderId,
		options.doneBy,
		(message, status) => new RotationDetailError(message, status),
	);
	const periodStart = chorePeriodStart(
		chore.frequency,
		await householdToday(householdId),
	);
	if (!periodStart) {
		throw new RotationDetailError("This chore isn't due today.", 409);
	}
	// The signed-in account (the parent, while a kid profile is active) is who
	// the database authorizes; it may act as the kid.
	const userId = state.actor.userId;
	if (!userId) throw new RotationDetailError('Sign in again to continue.', 403);
	const instance = await ensureInstance(
		householdId,
		choreId,
		periodStart,
		turnHolderId,
	);
	return { instance, doneBy, claims: JSON.stringify({ sub: userId }) };
}

/**
 * Completes the turn on a chore with no stages: awards the points and hands
 * the rotation to the next eligible member, in one transaction. When the
 * acting member isn't the turn-holder, they did it for them: the points are
 * theirs and the turn-holder's turn is used up.
 */
export async function completeRotationTurn(
	state: ProfileState,
	choreId: string,
	options: TurnOptions = {},
): Promise<TurnResult> {
	const { instance, doneBy, claims } = await prepare(state, choreId, options);
	try {
		const [, completed] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{
				completion_id: string;
				points: number;
				already_completed: boolean;
			}>(
				sql`select completion_id, points, already_completed from app.complete_chore_instance(${instance.id}::uuid, ${doneBy}::uuid)`,
			),
		]);
		const row = completed.rows[0];
		if (!row) throw new Error('complete_chore_instance returned no row');
		if (row.already_completed) throw alreadyDone();
		return {
			completionId: row.completion_id,
			points: row.points,
			choreCompleted: true,
		};
	} catch (err) {
		throw mapError(err);
	}
}

/**
 * Checks off a stage of a staged chore. The last stage completes the chore in
 * the same transaction (points and turn hand-off included). As with
 * `completeRotationTurn`, someone other than the turn-holder does it for them.
 */
export async function completeRotationStage(
	state: ProfileState,
	choreId: string,
	stageId: string,
	options: TurnOptions = {},
): Promise<TurnResult> {
	if (!UUID.test(stageId)) {
		throw new RotationDetailError('That stage was not found.', 404);
	}
	const { instance, doneBy, claims } = await prepare(state, choreId, options);
	try {
		const [, stage] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{
				chore_completed: boolean;
				completion_id: string | null;
				points: number;
				already_completed: boolean;
			}>(
				sql`select chore_completed, completion_id, points, already_completed from app.complete_chore_stage(${instance.id}::uuid, ${stageId}::uuid, ${doneBy}::uuid)`,
			),
		]);
		const row = stage.rows[0];
		if (!row) throw new Error('complete_chore_stage returned no row');
		if (row.chore_completed && row.already_completed) throw alreadyDone();
		return {
			completionId: row.completion_id,
			points: row.points,
			choreCompleted: row.chore_completed,
		};
	} catch (err) {
		throw mapError(err);
	}
}

/** The period already has an open completion, so this call wrote nothing. */
function alreadyDone() {
	return new RotationDetailError('This turn is already done for now.', 409);
}

/** Turns the database's custom errors into messages for the screen. */
function mapError(err: unknown): unknown {
	switch (sqlState(err)) {
		case 'P0002':
			return new RotationDetailError('That rotation chore was not found.', 404);
		case 'CP001':
			return new RotationDetailError('Finish the earlier stages first.', 409);
		case 'CP002':
			return new RotationDetailError('Finish every stage first.', 409);
		case 'CP004':
			return new RotationDetailError('That member was not found.', 404);
		case 'RT001':
			return new RotationDetailError(
				'The turn has already moved on. Reload to see whose turn it is.',
				409,
			);
		case '42501':
			return new RotationDetailError("You can't complete this turn.", 403);
		default:
			return err;
	}
}

/** The Postgres SQLSTATE of an error or of what it wraps. */
export function sqlState(err: unknown): string | undefined {
	let e: unknown = err;
	while (e instanceof Error) {
		const code = (e as { code?: unknown }).code;
		if (typeof code === 'string') return code;
		e = e.cause;
	}
	return undefined;
}
