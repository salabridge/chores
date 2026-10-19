import { householdMembers } from '@chore/db';
import { and, asc, eq } from 'drizzle-orm';
import {
	canEditMemberAvatar,
	type HouseholdMember,
	type HouseholdRole,
	sortMembers,
} from '../members.ts';
import { type AvatarInput, type KidInput, MAX_KIDS } from '../setup.ts';
import { db } from './drizzle.ts';
import { insertManagedKid } from './kids.ts';

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

/** Everyone in the household, owners first, then parents, then kids. */
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
		.where(eq(householdMembers.householdId, householdId))
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
