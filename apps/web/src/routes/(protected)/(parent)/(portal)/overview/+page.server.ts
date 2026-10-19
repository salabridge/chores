import { loadHouseholdFavours } from '#lib/server/favours.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { loadHouseholdOverview } from '#lib/server/overview.js';
import type { PageServerLoad } from './$types';

// The layout already sends non-parents away; this load needs the household
// itself and checks again, since layout and page loads run in parallel.
export const load: PageServerLoad = async () => {
	const { actor } = await requireParentProfile();
	// `favours` (SB-79): every favour waiting for a decision, the ones a kid
	// asked a parent about first. The "Favours to approve" panel is SB-80.
	const [overview, favours] = await Promise.all([
		loadHouseholdOverview(actor.householdId),
		loadHouseholdFavours(actor.householdId),
	]);
	return { overview, favours };
};
