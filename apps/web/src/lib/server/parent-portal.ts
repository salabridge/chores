import { redirect } from '@sveltejs/kit';
import { countPendingFavours } from './favours.ts';
import { parentGuard } from './profile-state.ts';
import { getProfileState, listParents } from './profiles.ts';

/**
 * Load for the desktop parent portal layout (SB-45). `hooks.server.ts` already
 * guards the whole `(parent)` group; this is the second check and also supplies
 * the sidebar's parent names. Anyone who isn't a parent acting as themselves (a
 * kid profile, an invited kid, or someone with no household) goes to /today.
 */
export async function loadParentPortal() {
	const state = await getProfileState();
	if (!state || parentGuard(state) !== 'allow') redirect(303, '/today');

	const [parents, pendingFavours] = await Promise.all([
		listParents(state.actor.householdId),
		countPendingFavours(state.actor.householdId),
	]);
	return {
		parents: parents.map((p) => ({ id: p.id, name: p.displayName })),
		/** Favours waiting for a decision (SB-79), for the nav badge (SB-80). */
		pendingFavours,
	};
}
