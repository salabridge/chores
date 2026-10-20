import { error } from '@sveltejs/kit';
import { GiftError, markGiftsSeen as markSeen } from '#lib/server/gifts.js';
import { requireProfile } from '#lib/server/guards.js';
import { command } from '$app/server';

// The "You got bonus points!" moment (SB-83). The member comes from the
// caller's own profile, never from the request; the database checks it's the
// kid's own login.

/** The kid dismissed the moment: the gifts it showed won't show again. */
export const markGiftsSeen = command(
	'unchecked',
	async (input: { giftIds: string[] }) => {
		const state = await requireProfile();
		try {
			await markSeen(state, input?.giftIds);
		} catch (e) {
			if (e instanceof GiftError) error(e.status, e.message);
			throw e;
		}
	},
);
