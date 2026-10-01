import { sql } from 'drizzle-orm';
import type { AuthenticatedTx } from './authenticated-db.ts';

// Server-side wrappers around the `app.*` RLS helpers (see
// ../migrations/0003_member_rls_helpers.sql). Call them inside `withAuth()` so
// they see the signed-in user. RLS enforces the same rules in the database;
// these are for routes that need to decide up front (a parent-only page, a
// clear 403 instead of an empty result).

/** Thrown by `requireHouseholdParent` when the signed-in user isn't a parent. */
export class NotHouseholdParentError extends Error {
	readonly householdId: string;

	// No parameter properties: Node's type stripping doesn't support them.
	constructor(householdId: string) {
		super(`Only a parent in household ${householdId} can do this`);
		this.name = 'NotHouseholdParentError';
		this.householdId = householdId;
	}
}

/** True when the signed-in user is a parent (role `owner` or `parent`) in the household. */
export async function isHouseholdParent(
	tx: AuthenticatedTx,
	householdId: string,
): Promise<boolean> {
	const { rows } = await tx.execute<{ ok: boolean }>(
		sql`select app.is_household_parent(${householdId}::uuid) as ok`,
	);
	return rows[0]?.ok === true;
}

/** Throws `NotHouseholdParentError` unless the signed-in user is a parent in the household. */
export async function requireHouseholdParent(
	tx: AuthenticatedTx,
	householdId: string,
): Promise<void> {
	if (!(await isHouseholdParent(tx, householdId))) {
		throw new NotHouseholdParentError(householdId);
	}
}

/** The signed-in user's `household_members.id` in the household, or null. */
export async function currentMemberId(
	tx: AuthenticatedTx,
	householdId: string,
): Promise<string | null> {
	const { rows } = await tx.execute<{ id: string | null }>(
		sql`select app.current_member_id(${householdId}::uuid) as id`,
	);
	return rows[0]?.id ?? null;
}

/**
 * True when the signed-in user may act as the member: it's their own row, or
 * it's a managed kid (no login) in a household where they're a parent.
 */
export async function canActAsMember(
	tx: AuthenticatedTx,
	memberId: string,
): Promise<boolean> {
	const { rows } = await tx.execute<{ ok: boolean }>(
		sql`select app.can_act_as_member(${memberId}::uuid) as ok`,
	);
	return rows[0]?.ok === true;
}

/**
 * Accepts a household invite for the signed-in user (their verified email must
 * match it) and returns their new `household_members.id`. Rejects when the
 * token is unknown, expired, already used, or for another email.
 */
export async function acceptHouseholdInvite(
	tx: AuthenticatedTx,
	token: string,
): Promise<string> {
	const { rows } = await tx.execute<{ id: string }>(
		sql`select app.accept_household_invite(${token}) as id`,
	);
	const id = rows[0]?.id;
	if (!id) throw new Error('accept_household_invite returned no member id');
	return id;
}
