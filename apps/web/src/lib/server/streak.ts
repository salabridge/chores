import { householdMembers } from '@chore/db';
import { householdStreaks } from '@chore/db/household-streaks';
import { chorePeriodStart } from '@chore/db/recurrence';
import type { AuthenticatedTx } from '@chore/db/rls';
import { SCREEN_STREAK_LOOKBACK_DAYS } from '@chore/db/streaks';
import { eq } from 'drizzle-orm';
import { buildStreakScreen, type StreakScreenData } from '../streak.ts';
import { db } from './drizzle.ts';
import { householdClock } from './household-today.ts';
import { memberPointsBalance, memberWeekPoints } from './member-stats.ts';
import { openChoresFor } from './rewards-shop.ts';

// Reads for the Streak tab (SB-44). As in today.ts, every query is scoped by
// the household of the caller's own profile; `member` must come from
// `getCurrentMember()`. The wording and the week math are in `../streak.ts`.

/** What `member` sees on the Streak tab. */
export async function loadStreakScreen(
	member: { id: string; householdId: string; displayName: string },
	now: Date = new Date(),
): Promise<StreakScreenData> {
	const householdId = member.householdId;
	// Only the week's points and the chips wait on the household's date.
	const [streaks, members, balance, [weekPoints, suggested]] =
		await Promise.all([
			// See member-stats.ts for why the owner client can run this.
			householdStreaks(db as unknown as AuthenticatedTx, householdId, {
				now,
				lookbackDays: SCREEN_STREAK_LOOKBACK_DAYS,
			}),
			db
				.select({ id: householdMembers.id, name: householdMembers.displayName })
				.from(householdMembers)
				.where(eq(householdMembers.householdId, householdId)),
			memberPointsBalance(member.id),
			householdClock(householdId, now).then(({ timeZone, today }) =>
				Promise.all([
					memberWeekPoints(
						member.id,
						timeZone,
						chorePeriodStart('weekly', today) ?? today,
					),
					openChoresFor(member, today),
				]),
			),
		]);
	return buildStreakScreen({
		member: { id: member.id, name: member.displayName },
		members,
		streaks,
		balance,
		weekPoints,
		suggested,
	});
}
