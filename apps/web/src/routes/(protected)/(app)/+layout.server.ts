import { pinStore } from '#lib/server/pin-store.js';
import { getProfileState } from '#lib/server/profiles.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const state = await getProfileState();
	const pin = state?.mode === 'kid' ? await pinStore.get(state.actor.id) : null;
	return {
		/** The managed kid this device is acting as, or null. */
		activeKid:
			state?.mode === 'kid'
				? {
						id: state.member.id,
						name: state.member.displayName,
						pinLocked: pin?.lockedAt != null,
					}
				: null,
	};
};
