import { requireUser } from '#lib/server/auth.js';
import {
	calendarPath,
	getOrCreateCalendarToken,
} from '#lib/server/calendar.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { getEffectiveLandingRoute } from '#lib/server/landing.js';
import type { PageServerLoad } from './$types';

// Parents only (the `(parent)` group guard in hooks.server.ts).
export const load: PageServerLoad = async ({ url }) => {
	const user = requireUser();
	const { member } = await requireParentProfile();
	const [landingRoute, token] = await Promise.all([
		getEffectiveLandingRoute(),
		getOrCreateCalendarToken(member.householdId, user.id),
	]);
	return {
		landingRoute,
		calendarUrl: new URL(calendarPath(token), url).href,
	};
};
