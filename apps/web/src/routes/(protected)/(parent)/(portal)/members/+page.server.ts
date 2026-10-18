import { requireParentProfile } from '#lib/server/guards.js';
import { listHouseholdMembers } from '#lib/server/members.js';
import type { PageServerLoad } from './$types';

// The layout already sends non-parents away; this load needs the household
// itself and checks again, since layout and page loads run in parallel.
export const load: PageServerLoad = async () => {
	const { actor } = await requireParentProfile();
	return { members: await listHouseholdMembers(actor.householdId) };
};
