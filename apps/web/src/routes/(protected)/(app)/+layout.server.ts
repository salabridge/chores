import { memberPointsBalance } from '#lib/server/member-stats.js';
import { pinStore } from '#lib/server/pin-store.js';
import { getProfileState } from '#lib/server/profiles.js';
import { isAvatarColor } from '#lib/setup.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const state = await getProfileState();
	const [pin, points] = await Promise.all([
		state?.mode === 'kid' ? pinStore.get(state.actor.id) : null,
		// The desktop header's balance (SB-68). Form actions re-run this load,
		// so it stays current after a completion or a claim.
		state ? memberPointsBalance(state.member.id) : null,
	]);
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
		/** Who the desktop header greets, or null without a household. */
		shellMember:
			state && points !== null
				? {
						name: state.member.displayName,
						points,
						tone: isAvatarColor(state.member.avatarColor)
							? state.member.avatarColor
							: undefined,
					}
				: null,
	};
};
