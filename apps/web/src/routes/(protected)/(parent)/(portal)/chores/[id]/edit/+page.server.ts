import { error } from '@sveltejs/kit';
import { choreToDraft } from '#lib/chore-creator.js';
import { listHouseholdMembers, loadEditableChore } from '#lib/server/chores.js';
import { requireParentProfile } from '#lib/server/guards.js';
import type { PageServerLoad } from './$types';

// The layout already sends non-parents away; this load needs the household
// itself and checks again, since layout and page loads run in parallel. A
// chore outside the household is a 404, the same as one that doesn't exist.
export const load: PageServerLoad = async ({ params }) => {
	const { actor } = await requireParentProfile();
	const chore = await loadEditableChore(actor.householdId, params.id);
	if (!chore) error(404, 'Chore not found');
	return {
		choreId: chore.id,
		draft: choreToDraft(chore),
		// Sent back with the save so a stale form is refused.
		updatedAt: chore.updatedAt.toISOString(),
		members: await listHouseholdMembers(actor.householdId),
	};
};
