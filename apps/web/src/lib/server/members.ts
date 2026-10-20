import { householdMembers } from '@chore/db';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
	canEditMemberAvatar,
	type HouseholdMember,
	type HouseholdRole,
	sortMembers,
} from '../members.ts';
import { type AvatarInput, type KidInput, MAX_KIDS } from '../setup.ts';
import { db } from './drizzle.ts';
import { insertManagedKid } from './kids.ts';
import type { ProfileState } from './profile-state.ts';

// The parent portal's Members screen (SB-66). As with the other web-side
// modules, the web app talks to Postgres as the table owner, so RLS does not
// apply here: every query is scoped by the household the server resolved for
// the signed-in parent (`requireParentProfile`), never by an id from the
// client.

/** A problem with what the parent sent, worded for the form. */
export class MemberError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MemberError';
	}
}

/**
 * Everyone in the household, owners first, then parents, then kids. Removed
 * members (SB-84) aren't listed.
 */
export async function listHouseholdMembers(
	householdId: string,
): Promise<HouseholdMember[]> {
	const rows = await db
		.select({
			id: householdMembers.id,
			displayName: householdMembers.displayName,
			role: householdMembers.role,
			avatarColor: householdMembers.avatarColor,
			avatarInitial: householdMembers.avatarInitial,
			birthYear: householdMembers.birthYear,
			userId: householdMembers.userId,
		})
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.householdId, householdId),
				isNull(householdMembers.removedAt),
			),
		)
		.orderBy(asc(householdMembers.joinedAt), asc(householdMembers.id));
	return sortMembers(
		rows.map(({ userId, ...member }) => ({
			...member,
			managed: userId === null,
		})),
	);
}

/**
 * Adds a managed kid (no login) to a household that has finished setup, with
 * the same rules and `MAX_KIDS` cap as setup's `addKid` (see kids.ts).
 */
export async function addManagedKid(
	householdId: string,
	input: KidInput,
): Promise<void> {
	if (!(await insertManagedKid(householdId, input, 'after-setup'))) {
		throw new MemberError(`A household can have up to ${MAX_KIDS} kids.`);
	}
}

/**
 * Changes a member's avatar colour and initial. `actor` is the signed-in
 * parent; the target is looked up inside the actor's household, then checked
 * with the same rule as the `household_members_update` policy, because this
 * connection bypasses RLS.
 */
export async function updateMemberAvatar(
	actor: { id: string; householdId: string; role: HouseholdRole },
	memberId: string,
	input: AvatarInput,
): Promise<void> {
	const [target] = await db
		.select({ id: householdMembers.id, role: householdMembers.role })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.id, memberId),
				eq(householdMembers.householdId, actor.householdId),
				isNull(householdMembers.removedAt),
			),
		);
	if (!target) throw new MemberError('That member was not found.');
	if (!canEditMemberAvatar(actor, target)) {
		throw new MemberError("You can't change that member's avatar.");
	}
	await db
		.update(householdMembers)
		.set({
			avatarColor: input.avatarColor,
			avatarInitial: input.avatarInitial,
		})
		.where(
			and(
				eq(householdMembers.id, memberId),
				eq(householdMembers.householdId, actor.householdId),
			),
		);
}

/** What `removeMember` did, for the confirmation on the Members screen. */
export interface RemovedMember {
	name: string;
	/** Points moved to `movedTo` (0 when none moved). */
	movedPoints: number;
	movedTo: string | null;
}

/** The parent's message for each refusal `app.remove_household_member` raises (its HINTs). */
const REMOVAL_PROBLEMS: Record<string, string> = {
	'not-signed-in': 'Sign in again to continue.',
	'member-not-found': 'That member was not found.',
	'not-parent': 'Only a parent can remove a member.',
	'kid-profile': 'A parent has to leave this kid profile first.',
	self: "You can't remove yourself.",
	'not-owner': 'Only an owner can remove a parent.',
	'last-owner': "The household's only owner can't be removed.",
	'invalid-recipient': 'Points can only move to another kid in the household.',
};

/** The HINT of a Postgres error, through drizzle's wrapping. */
function hintOf(err: unknown): string | undefined {
	let e: unknown = err;
	while (e instanceof Error) {
		const hint = (e as { hint?: unknown }).hint;
		if (typeof hint === 'string') return hint;
		e = e.cause;
	}
	return undefined;
}

/**
 * Removes a member from the signed-in parent's household (SB-84), optionally
 * moving a kid's points to another kid (`movePointsTo`, for a duplicate
 * profile). The work is `app.remove_household_member`, which authorizes by
 * the signed-in user (the JWT claims set in the same batch) and `acting_as`:
 * parents remove kids, only owners remove parents, and nobody removes
 * themselves or the last owner. The names come from the actor's own household,
 * never from the request.
 */
export async function removeMember(
	state: ProfileState,
	memberId: string,
	movePointsTo: string | null,
): Promise<RemovedMember> {
	const userId = state.actor.userId;
	if (!userId) throw new MemberError('Sign in again to continue.');
	const householdId = state.actor.householdId;
	const ids = movePointsTo ? [memberId, movePointsTo] : [memberId];
	const named = await db
		.select({ id: householdMembers.id, name: householdMembers.displayName })
		.from(householdMembers)
		.where(
			and(
				eq(householdMembers.householdId, householdId),
				isNull(householdMembers.removedAt),
			),
		);
	const nameOf = (id: string) => named.find((m) => m.id === id)?.name;
	const name = nameOf(memberId);
	if (!name || !ids.every((id) => nameOf(id))) {
		throw new MemberError('That member was not found.');
	}
	const claims = JSON.stringify({ sub: userId });
	// On a kid's profile the kid is acting, not the parent; the database refuses it.
	const actingAs = state.mode === 'kid' ? state.member.id : null;
	try {
		const [, removed] = await db.batch([
			db.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`),
			db.execute<{ moved: number }>(
				sql`select app.remove_household_member(${memberId}::uuid, ${movePointsTo}::uuid, ${actingAs}::uuid) as moved`,
			),
		]);
		const movedPoints = removed.rows[0]?.moved ?? 0;
		return {
			name,
			movedPoints,
			movedTo:
				movePointsTo && movedPoints !== 0
					? (nameOf(movePointsTo) ?? null)
					: null,
		};
	} catch (err) {
		const problem = REMOVAL_PROBLEMS[hintOf(err) ?? ''];
		if (problem) throw new MemberError(problem);
		throw err;
	}
}
