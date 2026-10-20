import { listUnseenGifts } from '#lib/server/gifts.js';
import { memberPointsBalance } from '#lib/server/member-stats.js';
import { pinStore } from '#lib/server/pin-store.js';
import { parentGuard, seesGiftMoment } from '#lib/server/profile-state.js';
import { getProfileState } from '#lib/server/profiles.js';
import { isAvatarColor } from '#lib/setup.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const state = await getProfileState();
	const [pin, points, unseenGifts] = await Promise.all([
		state?.mode === 'kid' ? pinStore.get(state.actor.id) : null,
		// The desktop header's balance (SB-68). Form actions re-run this load,
		// so it stays current after a completion or a claim.
		state ? memberPointsBalance(state.member.id) : null,
		// SB-83: a kid on their own login, or the managed kid whose profile is open.
		state && seesGiftMoment(state) ? listUnseenGifts(state.member) : [],
	]);
	return {
		/**
		 * True for a parent acting as themselves: the nav adds Overview and
		 * Account, the `(parent)` pages hooks.server.ts lets them open.
		 */
		isParent: state !== null && parentGuard(state) === 'allow',
		/** The managed kid this device is acting as, or null. */
		activeKid:
			state?.mode === 'kid'
				? {
						id: state.member.id,
						name: state.member.displayName,
						pinLocked: pin?.lockedAt != null,
					}
				: null,
		/**
		 * Gifts for the one-time "You got bonus points!" moment (SB-83), newest
		 * first. Empty for a parent in their own view.
		 */
		unseenGifts,
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
