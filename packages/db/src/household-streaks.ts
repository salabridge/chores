import { and, eq, gte, isNull } from 'drizzle-orm';
import { choreCompletions } from '../schema/chore-completions.table.ts';
import { choreInstances } from '../schema/chore-instances.table.ts';
import { choreSkips } from '../schema/chore-skips.table.ts';
import { chores } from '../schema/chores.table.ts';
import { householdMembers } from '../schema/household-members.table.ts';
import { households } from '../schema/households.table.ts';
import type { AuthenticatedTx } from './authenticated-db.ts';
import { addDays, localDate } from './recurrence.ts';
import {
	type DayException,
	DEFAULT_STREAK_LOOKBACK_DAYS,
	familyStreak,
	personalStreak,
	resolveDueChores,
	type Streak,
	skipKey,
} from './streaks.ts';

// Server-side streak query (SB-28). Call it inside `withAuth()`; RLS limits
// what the signed-in user can read. Streaks are computed on read from
// `chore_completions`, not stored. A parent's Skip of a personal chore
// (`chore_skips`, SB-29) doesn't count against the member. A rotation skip
// needs no entry here: the turn moves on and the skipped member has no
// instance for the period.

export interface HouseholdStreaks {
	/** Today's date in the household's time zone. */
	today: string;
	timeZone: string;
	family: Streak;
	/** Each member's streak, keyed by `household_members.id`. */
	members: Record<string, Streak>;
}

export interface HouseholdStreaksOptions {
	/** Override "now" (tests, or computing a past day). */
	now?: Date;
	/** How many days back to look; a longer streak is reported as this many. */
	lookbackDays?: number;
	/** Parent-granted exceptions, same story: nothing stores these yet. */
	exceptions?: readonly DayException[];
}

/**
 * The household's family streak and every member's personal streak, with days
 * counted in `households.timezone`.
 */
export async function householdStreaks(
	tx: AuthenticatedTx,
	householdId: string,
	options: HouseholdStreaksOptions = {},
): Promise<HouseholdStreaks> {
	const lookbackDays = options.lookbackDays ?? DEFAULT_STREAK_LOOKBACK_DAYS;
	const [household] = await tx
		.select({ timeZone: households.timezone })
		.from(households)
		.where(eq(households.id, householdId));
	if (!household) throw new Error(`No household ${householdId}`);
	const { timeZone } = household;

	const today = localDate(timeZone, options.now);
	const from = addDays(today, -lookbackDays);
	// Pad the instant bound by a day each way so every local date in range is
	// covered whatever the offset; resolveDueChores() does the exact check.
	const since = new Date(`${addDays(from, -1)}T00:00:00Z`);

	const [members, choreRows, instances, completions, skips] = await Promise.all(
		[
			tx
				.select({ id: householdMembers.id })
				.from(householdMembers)
				.where(eq(householdMembers.householdId, householdId)),
			tx
				.select({
					id: chores.id,
					frequency: chores.frequency,
					assignedMemberId: chores.assignedMemberId,
					createdAt: chores.createdAt,
				})
				.from(chores)
				.where(eq(chores.householdId, householdId)),
			tx
				.select({
					id: choreInstances.id,
					choreId: choreInstances.choreId,
					periodStart: choreInstances.periodStart,
					assignedMemberId: choreInstances.assignedMemberId,
				})
				.from(choreInstances)
				.where(
					and(
						eq(choreInstances.householdId, householdId),
						gte(choreInstances.periodStart, addDays(from, -7)),
					),
				),
			tx
				.select({
					instanceId: choreCompletions.instanceId,
					completedAt: choreCompletions.completedAt,
				})
				.from(choreCompletions)
				.where(
					and(
						eq(choreCompletions.householdId, householdId),
						isNull(choreCompletions.reopenedAt),
						gte(choreCompletions.completedAt, since),
					),
				),
			// Only personal chores: a rotation skip moves the turn instead.
			tx
				.select({
					choreId: choreSkips.choreId,
					periodStart: choreSkips.periodStart,
				})
				.from(choreSkips)
				.innerJoin(chores, eq(chores.id, choreSkips.choreId))
				.where(
					and(
						eq(choreSkips.householdId, householdId),
						eq(chores.type, 'personal'),
						gte(choreSkips.periodStart, addDays(from, -7)),
					),
				),
		],
	);

	const due = resolveDueChores({
		chores: choreRows,
		instances,
		completions,
		timeZone,
		from,
		today,
		skippedPeriods: new Set(
			skips.map((s) => skipKey(s.choreId, s.periodStart)),
		),
	});
	const exceptions = options.exceptions ?? [];
	const memberIds = members.map((m) => m.id);
	return {
		today,
		timeZone,
		family: familyStreak(due, memberIds, today, exceptions, lookbackDays),
		members: Object.fromEntries(
			memberIds.map((id) => [
				id,
				personalStreak(due, id, today, exceptions, lookbackDays),
			]),
		),
	};
}
