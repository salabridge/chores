import { redirect } from '@sveltejs/kit';
import { pinStore } from '#lib/server/pin-store.js';
import { isParentRole } from '#lib/server/profile-state.js';
import { getProfileState, listManagedKids } from '#lib/server/profiles.js';
import type { PageServerLoad } from './$types';

// The "Who's using ChoreLoop?" picker, shown after a parent signs in. A kid
// profile never reaches it (`hooks.server.ts` sends it to /today), and
// anyone with nobody to choose between skips it.
export const load: PageServerLoad = async () => {
	const state = await getProfileState();
	if (!state || !isParentRole(state.actor.role)) redirect(303, '/today');

	const kids = await listManagedKids(state.actor.householdId);
	if (kids.length === 0) redirect(303, '/today');

	const pin = await pinStore.get(state.actor.id);
	return {
		hasPin: pin !== null,
		parent: { id: state.actor.id, name: state.actor.displayName },
		kids: kids.map((kid) => ({ id: kid.id, name: kid.displayName })),
	};
};
