import { getProfileState } from '#lib/server/profiles.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const state = await getProfileState();
	return {
		/** The managed kid this device is acting as, or null. */
		activeKid:
			state?.mode === 'kid'
				? { id: state.member.id, name: state.member.displayName }
				: null,
	};
};
