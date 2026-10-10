import { households } from '@chore/db';
import { localDate } from '@chore/db/recurrence';
import { eq } from 'drizzle-orm';
import { db } from './drizzle.ts';

// A household's days are counted in `households.timezone` (SB-28). Anything
// that decides "today" for a household, such as the Overview's due chores and
// the period a Skip is logged against, has to go through here so they agree.

/** The household's time zone and today's date in it. */
export async function householdClock(
	householdId: string,
	now: Date = new Date(),
): Promise<{ timeZone: string; today: string }> {
	const [household] = await db
		.select({ timeZone: households.timezone })
		.from(households)
		.where(eq(households.id, householdId));
	const timeZone = household?.timeZone ?? 'UTC';
	return { timeZone, today: localDate(timeZone, now) };
}

/** Today's date (`YYYY-MM-DD`) in the household's time zone. */
export async function householdToday(
	householdId: string,
	now: Date = new Date(),
): Promise<string> {
	return (await householdClock(householdId, now)).today;
}
