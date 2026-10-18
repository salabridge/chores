import { getProfileState } from '#lib/server/profiles.js';
import { loadToday } from '#lib/server/today.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Sending a user without a household to setup belongs to hooks.server.ts
	// (SB-56); until then they see an empty state.
	// `wide`: Today has a desktop design (SB-68), so the shell gives it the
	// full content width from lg instead of the phone column.
	const state = await getProfileState();
	if (!state) return { today: null, wide: true };
	return { today: await loadToday(state.member), wide: true };
};
