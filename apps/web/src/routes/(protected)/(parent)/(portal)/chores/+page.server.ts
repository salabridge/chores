import { GROUPING_COOKIE, parseGrouping } from '#lib/chores-list.js';
import { loadChoresList } from '#lib/server/chores-list.js';
import { requireParentProfile } from '#lib/server/guards.js';
import type { PageServerLoad } from './$types';

// The layout already sends non-parents away; this load needs the household
// itself and checks again, since layout and page loads run in parallel.
export const load: PageServerLoad = async ({ cookies }) => {
	const { actor } = await requireParentProfile();
	return {
		...(await loadChoresList(actor.householdId)),
		// Read here so the first render already has the grouping this device chose.
		grouping: parseGrouping(cookies.get(GROUPING_COOKIE)),
	};
};
