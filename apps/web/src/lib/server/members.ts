import { householdMembers } from '@chore/db';
import { asc, eq, sql } from 'drizzle-orm';
import { type HouseholdMember, sortMembers } from '../members.ts';
import { type KidInput, MAX_KIDS } from '../setup.ts';
import { db } from './drizzle.ts';

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
 * Adds a managed kid (no login) to a household that has finished setup. Uses
 * the same rules as setup's `addKid`, including the `MAX_KIDS` cap, counted
 * and inserted behind a lock on the household row so a double submit can't
 * go past it.
 */
export async function addManagedKid(
	householdId: string,
	input: KidInput,
): Promise<void> {
	const [, added] = await db.batch([
		db.execute(
			sql`select 1 from households where id = ${householdId} for update`,
		),
		// A new statement, so it sees kids committed while it waited on the lock.
		db.execute<{ id: string }>(sql`
			insert into household_members
				(household_id, user_id, role, display_name, avatar_color, avatar_initial, birth_year, weekly_goal_points)
			select h.id, null, 'kid', ${input.displayName}, ${input.avatarColor}, ${input.avatarInitial},
				${input.birthYear}::smallint, ${input.weeklyGoalPoints}::integer
			from households h
			where h.id = ${householdId}
				and (
					select count(*) from household_members m
					where m.household_id = h.id and m.role = 'kid'
				) < ${MAX_KIDS}
			returning id`),
	]);
	if (added.rows.length === 0) {
		throw new MemberError(`A household can have up to ${MAX_KIDS} kids.`);
	}
}
