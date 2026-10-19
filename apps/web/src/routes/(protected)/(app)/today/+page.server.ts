import { loadMemberFavours } from '#lib/server/favours.js';
import { getProfileState } from '#lib/server/profiles.js';
import { loadToday } from '#lib/server/today.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Sending a user without a household to setup belongs to hooks.server.ts
	// (SB-56); until then they see an empty state.
	// `wide`: Today has a desktop design (SB-68), so the shell gives it the
	// full content width from lg instead of the phone column.
	const state = await getProfileState();
	if (!state) return { today: null, favours: null, wide: true };
	// `favours` (SB-79): favours on the member's chores waiting for their OK,
	// and the ones they did for others. The UI is SB-80.
	const [today, favours] = await Promise.all([
		loadToday(state.member),
		loadMemberFavours(state.member),
	]);
	return { today, favours, wide: true };
};
