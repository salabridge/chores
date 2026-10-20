import { sql } from 'drizzle-orm';
import { type KidInput, MAX_KIDS } from '../setup.ts';
import { db } from './drizzle.ts';

// Adding a managed kid (no login), shared by setup's Kids step and the
// Members screen (SB-66) so the lock, the `MAX_KIDS` cap and the columns live
// in one place. Counting and inserting in separate requests would let a double
// submit (or two tabs) both see room and go past the cap, so both run in one
// transaction behind a lock on the household row: a concurrent add waits for
// this one to commit, then counts its kid.

/**
 * Inserts a managed kid into `householdId`. `when` says which side of setup
 * the household must be on; the insert is refused when it isn't, or when the
 * household already has `MAX_KIDS` kids. Returns whether a kid was added, so
 * each caller can word its own error.
 */
export async function insertManagedKid(
	householdId: string,
	input: KidInput,
	when: 'during-setup' | 'after-setup',
): Promise<boolean> {
	const setupClause =
		when === 'during-setup'
			? sql`h.setup_completed_at is null`
			: sql`h.setup_completed_at is not null`;
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
				and ${setupClause}
				and (
					select count(*) from household_members m
					where m.household_id = h.id and m.role = 'kid' and m.removed_at is null
				) < ${MAX_KIDS}
			returning id`),
	]);
	return added.rows.length > 0;
}
