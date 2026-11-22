import { requireUser } from '#lib/server/auth.js';
import { calendarPath, regenerateCalendarToken } from '#lib/server/calendar.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { form, getRequestEvent } from '$app/server';

/**
 * Makes a new calendar link for the household (SB-101), which stops the old
 * one working. Parent-only. Takes no input: the household is the caller's own.
 */
export const regenerateCalendarLink = form('unchecked', async () => {
	const user = requireUser();
	const { member } = await requireParentProfile();
	const token = await regenerateCalendarToken(member.householdId, user.id);
	return { url: new URL(calendarPath(token), getRequestEvent().url).href };
});
