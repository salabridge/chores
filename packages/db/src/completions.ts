import { and, eq, gte, sql } from 'drizzle-orm';
import { householdMembers } from '../schema/household-members.table.ts';
import { pointsLedger } from '../schema/points-ledger.table.ts';
import type { AuthenticatedTx } from './authenticated-db.ts';

// Server-side helpers for chore completions and the points ledger (SB-26).
// Call them inside `withAuth()`; RLS and the `app.*` functions decide who may
// do what. Everything that writes (completing, reopening) runs in the
// caller's transaction, so a completion, its points and a rotation hand-off
// commit together.

/** Thrown when a stage is checked before an earlier stage is done (it's still locked). */
export class StageLockedError extends Error {
	readonly instanceId: string;
	readonly stageId: string;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(
		instanceId: string,
		stageId: string,
		options?: { cause?: unknown },
	) {
		super(
			`Stage ${stageId} is locked until the earlier stages are done`,
			options,
		);
		this.name = 'StageLockedError';
		this.instanceId = instanceId;
		this.stageId = stageId;
	}
}

/** Thrown by `completeChore` when a chore with stages still has stages left. */
export class ChoreStagesIncompleteError extends Error {
	readonly instanceId: string;

	constructor(instanceId: string, options?: { cause?: unknown }) {
		super(`Chore instance ${instanceId} still has stages to finish`, options);
		this.name = 'ChoreStagesIncompleteError';
		this.instanceId = instanceId;
	}
}

/** Thrown when a chore instance has no assignee, so there is nobody to credit. */
export class ChoreNotAssignedError extends Error {
	readonly instanceId: string;

	constructor(instanceId: string, options?: { cause?: unknown }) {
		super(`Chore instance ${instanceId} has no assignee`, options);
		this.name = 'ChoreNotAssignedError';
		this.instanceId = instanceId;
	}
}

export interface CompleteChoreResult {
	completionId: string;
	/** Points awarded by this call; 0 when the chore was already completed. */
	points: number;
	/** True when this call changed nothing because the chore was already done. */
	alreadyCompleted: boolean;
	/** Whose turn a rotation chore moved to; null for a personal chore or a repeat call. */
	nextMemberId: string | null;
}

export type CompleteStageResult =
	| { choreCompleted: false }
	| ({ choreCompleted: true } & CompleteChoreResult);

/**
 * Completes a chore for one period and awards its points. Safe to repeat: a
 * second call returns the existing completion with `alreadyCompleted: true`
 * and awards nothing. For a chore with stages, finish the stages first
 * (`completeChoreStage` completes the chore itself on the last one). For a
 * rotation chore this also moves the turn on, in the same transaction (the
 * database error RT001 if a skip already moved the turn past the assignee).
 *
 * A parent, or someone who can act as the chore's assignee, may call it.
 * Otherwise Postgres raises insufficient_privilege.
 */
export async function completeChore(
	tx: AuthenticatedTx,
	instanceId: string,
): Promise<CompleteChoreResult> {
	try {
		const { rows } = await tx.execute<{
			completion_id: string;
			points: number;
			already_completed: boolean;
			next_member_id: string | null;
		}>(
			sql`select completion_id, points, already_completed, next_member_id from app.complete_chore_instance(${instanceId}::uuid)`,
		);
		const row = rows[0];
		if (!row) throw new Error('complete_chore_instance returned no row');
		return {
			completionId: row.completion_id,
			points: row.points,
			alreadyCompleted: row.already_completed,
			nextMemberId: row.next_member_id,
		};
	} catch (err) {
		throw mapCompletionError(err, instanceId);
	}
}

/**
 * Checks off one stage. Stages unlock in order (`StageLockedError` if an
 * earlier one isn't done), and checking a done stage again does nothing. When
 * it was the last stage, the chore completes in the same call and the result
 * carries the points ("Complete Chore"); otherwise `choreCompleted` is false.
 */
export async function completeChoreStage(
	tx: AuthenticatedTx,
	instanceId: string,
	stageId: string,
): Promise<CompleteStageResult> {
	try {
		const { rows } = await tx.execute<{
			chore_completed: boolean;
			completion_id: string | null;
			points: number;
			already_completed: boolean | null;
			next_member_id: string | null;
		}>(
			sql`select chore_completed, completion_id, points, already_completed, next_member_id from app.complete_chore_stage(${instanceId}::uuid, ${stageId}::uuid)`,
		);
		const row = rows[0];
		if (!row) throw new Error('complete_chore_stage returned no row');
		if (!row.chore_completed || !row.completion_id) {
			return { choreCompleted: false };
		}
		return {
			choreCompleted: true,
			completionId: row.completion_id,
			points: row.points,
			alreadyCompleted: row.already_completed === true,
			nextMemberId: row.next_member_id,
		};
	} catch (err) {
		throw mapCompletionError(err, instanceId, stageId);
	}
}

/**
 * Parent-only: reopens a completion, takes its points back with a reversing
 * ledger row, and unchecks the last stage of a staged chore. Returns false if
 * it was already reopened. A rotation's turn is not moved back.
 */
export async function reopenCompletion(
	tx: AuthenticatedTx,
	completionId: string,
): Promise<boolean> {
	const { rows } = await tx.execute<{ reopened: boolean }>(
		sql`select app.reopen_chore_completion(${completionId}::uuid) as reopened`,
	);
	return rows[0]?.reopened === true;
}

/** A member's points: the sum of their ledger rows (there is no stored counter). */
export async function memberPointsBalance(
	tx: AuthenticatedTx,
	memberId: string,
): Promise<number> {
	const [row] = await tx
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(eq(pointsLedger.memberId, memberId));
	return row?.total ?? 0;
}

export interface WeeklyGoalProgress {
	/** Points earned from chores since `since` (completions net of reversals). */
	earned: number;
	/** The member's `weekly_goal_points`. */
	goal: number;
	/** `goal - earned`, never below 0 ("40 points left"). */
	remaining: number;
	/** Whole percent of the goal reached, capped at 100. A goal of 0 counts as reached. */
	percent: number;
	reached: boolean;
}

/** Turns earned points and a goal into the numbers the progress bar needs. */
export function weeklyGoalProgress(
	earned: number,
	goal: number,
): WeeklyGoalProgress {
	const clamped = Math.max(0, earned);
	const reached = clamped >= goal;
	return {
		earned: clamped,
		goal,
		remaining: Math.max(0, goal - clamped),
		percent:
			goal <= 0 ? 100 : Math.min(100, Math.floor((clamped / goal) * 100)),
		reached,
	};
}

/**
 * A member's progress toward their weekly goal ("160 / 200 Points reached").
 * `weekStart` is the start of the week as an instant: compute it from the
 * household's local Monday (`chorePeriodStart('weekly', localDate(tz))`), so
 * the week doesn't shift with the server's time zone. Only chore points count
 * (completions and their reversals), not reward claims or adjustments.
 */
export async function weeklyPointsProgress(
	tx: AuthenticatedTx,
	memberId: string,
	weekStart: Date,
): Promise<WeeklyGoalProgress> {
	const [member] = await tx
		.select({ goal: householdMembers.weeklyGoalPoints })
		.from(householdMembers)
		.where(eq(householdMembers.id, memberId));
	if (!member) throw new Error(`No household member ${memberId}`);
	const [row] = await tx
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(
			and(
				eq(pointsLedger.memberId, memberId),
				gte(pointsLedger.createdAt, weekStart),
				sql`${pointsLedger.reason} in ('completion', 'reversal')`,
			),
		);
	return weeklyGoalProgress(row?.total ?? 0, member.goal);
}

function mapCompletionError(
	err: unknown,
	instanceId: string,
	stageId?: string,
): unknown {
	switch (sqlState(err)) {
		case 'CP001':
			return new StageLockedError(instanceId, stageId ?? '', { cause: err });
		case 'CP002':
			return new ChoreStagesIncompleteError(instanceId, { cause: err });
		case 'CP003':
			return new ChoreNotAssignedError(instanceId, { cause: err });
		default:
			return err;
	}
}

/** The Postgres SQLSTATE of an error or of what it wraps (drizzle wraps pg errors). */
function sqlState(err: unknown): string | undefined {
	let e: unknown = err;
	while (e instanceof Error) {
		const code = (e as { code?: unknown }).code;
		if (typeof code === 'string') return code;
		e = e.cause;
	}
	return undefined;
}
