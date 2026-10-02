import { asc, eq, sql } from 'drizzle-orm';
import { choreRotationMembers } from '../schema/chore-rotation-members.table.ts';
import { choreRotations } from '../schema/chore-rotations.table.ts';
import { householdMembers } from '../schema/household-members.table.ts';
import type { RotationScope } from '../schema/rotation-scope.ts';
import type { AuthenticatedTx } from './authenticated-db.ts';
import { type RotationTurns, rotationTurns } from './rotation.ts';

// Server-side helpers for rotation chores (SB-25). Call them inside
// `withAuth()`; RLS and app.advance_chore_rotation decide what the signed-in
// user may see and do.

/** Thrown by `advanceRotation` when the turn already moved past `fromMemberId`. */
export class StaleRotationTurnError extends Error {
	readonly choreId: string;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(choreId: string, options?: { cause?: unknown }) {
		super(`The turn for chore ${choreId} has already moved on`, options);
		this.name = 'StaleRotationTurnError';
		this.choreId = choreId;
	}
}

/** Thrown by `advanceRotation` when nobody in the rotation is eligible. */
export class NoEligibleRotationMemberError extends Error {
	readonly choreId: string;

	constructor(choreId: string, options?: { cause?: unknown }) {
		super(`The rotation for chore ${choreId} has no eligible members`, options);
		this.name = 'NoEligibleRotationMemberError';
		this.choreId = choreId;
	}
}

export interface AdvanceRotationOptions {
	/**
	 * Whose turn the caller is ending. If the turn has already moved on (a
	 * double submit, another device), the advance is refused with
	 * `StaleRotationTurnError` rather than skipping someone.
	 */
	fromMemberId: string;
	/**
	 * `completed` (default): the member did the chore and becomes Done Last.
	 * `skipped`: the turn moves on without a completion (the Overview "Skip",
	 * SB-29); Done Last is unchanged and no points should be awarded. Parents
	 * only.
	 */
	outcome?: 'completed' | 'skipped';
}

export interface AdvanceRotationResult {
	/** Whose turn it is now. */
	memberId: string;
	/** True when the turn wrapped to the start of the loop ("Loop Reset"). */
	wrapped: boolean;
}

/**
 * Hands a rotation's turn to the next eligible member (by position, skipping
 * excluded members, wrapping to the start). Runs in the caller's transaction
 * and locks the rotation row, so the completion and its points (SB-26) can be
 * written in the same `withAuth` callback and commit together:
 *
 * ```ts
 * await db.withAuth(token, async (tx) => {
 *   const next = await advanceRotation(tx, choreId, { fromMemberId });
 *   // ...record the completion / ledger rows in the same tx
 * });
 * ```
 *
 * Completing needs a parent, or someone who can act as the member whose turn
 * it is; skipping needs a parent. Otherwise Postgres raises
 * insufficient_privilege.
 */
export async function advanceRotation(
	tx: AuthenticatedTx,
	choreId: string,
	{ fromMemberId, outcome = 'completed' }: AdvanceRotationOptions,
): Promise<AdvanceRotationResult> {
	try {
		const { rows } = await tx.execute<{
			member_id: string;
			wrapped: boolean;
		}>(
			sql`select member_id, wrapped from app.advance_chore_rotation(${choreId}::uuid, ${fromMemberId}::uuid, ${outcome === 'completed'})`,
		);
		const row = rows[0];
		if (!row) throw new Error('advance_chore_rotation returned no row');
		return { memberId: row.member_id, wrapped: row.wrapped };
	} catch (err) {
		const code = sqlState(err);
		if (code === 'RT001') {
			throw new StaleRotationTurnError(choreId, { cause: err });
		}
		if (code === 'RT002') {
			throw new NoEligibleRotationMemberError(choreId, { cause: err });
		}
		throw err;
	}
}

/** A rotation member with what the UI needs to show them. */
export interface RotationMemberView {
	memberId: string;
	position: number;
	eligible: boolean;
	exclusionReason: string | null;
	displayName: string;
	avatarColor: string | null;
	avatarInitial: string | null;
}

export interface RotationView extends RotationTurns<RotationMemberView> {
	choreId: string;
	scope: RotationScope;
	scopeLabel: string | null;
	/** Every member in turn order, excluded ones included. */
	members: RotationMemberView[];
	turnStartedAt: Date;
	lastCompletedAt: Date | null;
}

/**
 * A rotation chore's turns for the shared-chore screen (Done Last / Active
 * Turn / Next Up) and the Overview (`handoffChain`), or null when the chore
 * has no rotation (or the user can't see it).
 */
export async function getRotationTurns(
	tx: AuthenticatedTx,
	choreId: string,
): Promise<RotationView | null> {
	const [rotation] = await tx
		.select()
		.from(choreRotations)
		.where(eq(choreRotations.choreId, choreId));
	if (!rotation) return null;
	const members = await tx
		.select({
			memberId: choreRotationMembers.memberId,
			position: choreRotationMembers.position,
			eligible: choreRotationMembers.eligible,
			exclusionReason: choreRotationMembers.exclusionReason,
			displayName: householdMembers.displayName,
			avatarColor: householdMembers.avatarColor,
			avatarInitial: householdMembers.avatarInitial,
		})
		.from(choreRotationMembers)
		.innerJoin(
			householdMembers,
			eq(householdMembers.id, choreRotationMembers.memberId),
		)
		.where(eq(choreRotationMembers.choreId, choreId))
		.orderBy(asc(choreRotationMembers.position));
	return {
		choreId,
		scope: rotation.scope,
		scopeLabel: rotation.scopeLabel,
		members,
		turnStartedAt: rotation.turnStartedAt,
		lastCompletedAt: rotation.lastCompletedAt,
		...rotationTurns(
			members,
			rotation.currentMemberId,
			rotation.lastCompletedMemberId,
		),
	};
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
