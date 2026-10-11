import { getProfileState } from '#lib/server/profiles.js';
import { loadToday } from '#lib/server/today.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Sending a user without a household to setup belongs to hooks.server.ts
	// (SB-56); until then they see an empty state.
	const state = await getProfileState();
	if (!state) return { today: null };
	return { today: await loadToday(state.member) };
};
