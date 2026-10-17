import { getProfileState } from '#lib/server/profiles.js';
import { loadStreakScreen } from '#lib/server/streak.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// As on Today, a user without a household sees an empty state.
	const state = await getProfileState();
	if (!state) return { streak: null };
	return { streak: await loadStreakScreen(state.member) };
};
