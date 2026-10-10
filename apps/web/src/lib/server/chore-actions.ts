import {
	choreCompletions,
	choreInstances,
	choreReminders,
	choreRotationMembers,
	choreRotations,
	choreSkips,
	chores,
	householdMembers,
} from '@chore/db';
import { chorePeriodStart, localDate } from '@chore/db/recurrence';
import { rotationTurns } from '@chore/db/rotation';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
	type ActionPlan,
	type ChoreActionFacts,
	planRemind,
	planSkip,
} from '../chore-actions.ts';
import { db } from './drizzle.ts';
import type { ProfileState } from './profile-state.ts';

// Parent actions on the Overview's Chore Status table: Skip and Remind (SB-29).
// As with the other web-side modules, the web app talks to Postgres as the
// table owner, so every query is scoped by the caller's household. Skipping a
// rotation turn goes through `app.advance_chore_rotation(..., false)`, which
// authorizes by `app.current_user_id()`; it runs in a batch (one transaction
// on the HTTP driver) that sets the signed-in parent first.

// Households have no time zone yet, so "today" is the UTC date (as in the
// Overview). Swap this for the household's zone once it is stored.
const HOUSEHOLD_TIME_ZONE = 'UTC';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A problem with the request, worded for the table's error line. */
export class ChoreActionError extends Error {
	readonly status: 400 | 403 | 404 | 409;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(message: string, status: 400 | 403 | 404 | 409 = 400) {
		super(message);
		this.name = 'ChoreActionError';
		this.status = status;
	}
}

interface Loaded {
	chore: typeof chores.$inferSelect;
	periodStart: string | null;
	facts: ChoreActionFacts;
}

/** Everything the rules need about one chore today, scoped to the household. */
async function load(householdId: string, choreId: string): Promise<Loaded> {
	const notFound = () => new ChoreActionError('That chore was not found.', 404);
	if (!UUID.test(choreId)) throw notFound();
	const [chore] = await db
		.select()
		.from(chores)
		.where(and(eq(chores.id, choreId), eq(chores.householdId, householdId)));
	if (!chore) throw notFound();

	const periodStart = chorePeriodStart(
		chore.frequency,
		localDate(HOUSEHOLD_TIME_ZONE),
	);

	let holderId: string | null = null;
	if (chore.type === 'rotation') {
		const [rotation] = await db
			.select()
			.from(choreRotations)
			.where(eq(choreRotations.choreId, choreId));
		if (rotation) {
			const members = await db
				.select({
					memberId: choreRotationMembers.memberId,
					position: choreRotationMembers.position,
					eligible: choreRotationMembers.eligible,
					exclusionReason: choreRotationMembers.exclusionReason,
				})
				.from(choreRotationMembers)
				.where(eq(choreRotationMembers.choreId, choreId))
				.orderBy(asc(choreRotationMembers.position));
			holderId =
				rotationTurns(
					members,
					rotation.currentMemberId,
					rotation.lastCompletedMemberId,
				).activeTurn?.memberId ?? null;
		}
	}

	let instance: typeof choreInstances.$inferSelect | undefined;
	let completed = false;
	let alreadySkipped = false;
	if (periodStart) {
		[instance] = await db
			.select()
			.from(choreInstances)
			.where(
				and(
					eq(choreInstances.choreId, choreId),
					eq(choreInstances.periodStart, periodStart),
				),
			);
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
			completed = completion !== undefined;
		}
		const [skip] = await db
			.select({ id: choreSkips.id })
			.from(choreSkips)
			.where(
				and(
					eq(choreSkips.choreId, choreId),
					eq(choreSkips.periodStart, periodStart),
				),
			);
		alreadySkipped = skip !== undefined;
	}
	if (chore.type === 'personal') {
		holderId = instance?.assignedMemberId ?? chore.assignedMemberId ?? null;
	}

	return {
		chore,
		periodStart,
		facts: {
			type: chore.type,
			dueToday: periodStart !== null,
			completed,
			holderId,
			alreadySkipped,
		},
	};
}

function refusal(plan: Extract<ActionPlan, { ok: false }>) {
	return new ChoreActionError(plan.message, plan.status);
}

/**
 * Skips a chore for now, without points. A rotation hands its turn to the
 * next eligible member; a personal chore is marked skipped for this period.
 * Either way a `chore_skips` row records it. Returns whose turn it is now for
 * a rotation (null for a personal chore).
 */
export async function skipChore(
	state: ProfileState,
	choreId: string,
): Promise<{ nextMemberId: string | null }> {
	const householdId = state.actor.householdId;
	const userId = state.actor.userId;
	if (!userId) throw new ChoreActionError('Sign in again to continue.', 403);
	const { chore, periodStart, facts } = await load(householdId, choreId);
	const plan = planSkip(facts);
	if (!plan.ok) throw refusal(plan);
	if (!periodStart) {
		throw new ChoreActionError("This chore isn't due today.", 409);
	}

	const record = db.insert(choreSkips).values({
		householdId,
		choreId,
		periodStart,
		memberId: plan.holderId,
		createdBy: userId,
	});

	if (chore.type === 'personal') {
		if (!plan.noop) await record;
		return { nextMemberId: null };
	}

	const claims = JSON.stringify({ sub: userId });
	try {
		const [, advanced] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{ member_id: string }>(
				sql`select member_id from app.advance_chore_rotation(${choreId}::uuid, ${plan.holderId}::uuid, false)`,
			),
			record,
		]);
		const nextMemberId = advanced.rows[0]?.member_id ?? null;
		// Keep an untouched instance with the new turn-holder, so the table shows
		// them and completing doesn't fail on a stale assignee.
		if (nextMemberId) {
			await db.execute(sql`
				update chore_instances ci set assigned_member_id = ${nextMemberId}::uuid
				where ci.chore_id = ${choreId}::uuid
					and ci.period_start = ${periodStart}::date
					and not exists (select 1 from chore_completions c where c.instance_id = ci.id)
					and not exists (select 1 from chore_stage_progress p where p.instance_id = ci.id)`);
		}
		return { nextMemberId };
	} catch (err) {
		throw mapError(err);
	}
}

/**
 * Nudges whoever holds the chore. MVP delivery is in-app only: this writes a
 * `chore_reminders` row, and the assignee's Today screen shows it as a banner.
 */
export async function remindChore(
	state: ProfileState,
	choreId: string,
): Promise<{ assigneeId: string; assigneeName: string }> {
	const householdId = state.actor.householdId;
	const { facts } = await load(householdId, choreId);
	const plan = planRemind(facts);
	if (!plan.ok) throw refusal(plan);

	const [assignee] = await db
		.select({ name: householdMembers.displayName })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.id, plan.holderId),
				eq(householdMembers.householdId, householdId),
			),
		);
	if (!assignee) throw new ChoreActionError('That member was not found.', 404);

	await db.insert(choreReminders).values({
		householdId,
		choreId,
		assigneeMemberId: plan.holderId,
		createdBy: state.actor.userId ?? null,
	});
	return { assigneeId: plan.holderId, assigneeName: assignee.name };
}

/** Turns the database's custom errors into messages for the table. */
function mapError(err: unknown): unknown {
	switch (sqlState(err)) {
		case 'RT001':
			return new ChoreActionError(
				'The turn has already moved on. Reload to see whose turn it is.',
				409,
			);
		case 'RT002':
			return new ChoreActionError('Nobody is eligible to take this turn.', 409);
		case '42501':
			return new ChoreActionError('Only a parent can do this.', 403);
		default:
			return err;
	}
}

/** The Postgres SQLSTATE of an error or of what it wraps. */
function sqlState(err: unknown): string | undefined {
	let e: unknown = err;
	while (e instanceof Error) {
		const code = (e as { code?: unknown }).code;
		if (typeof code === 'string') return code;
		e = e.cause;
	}
	return undefined;
}
