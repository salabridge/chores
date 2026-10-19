import type { FavourActions } from '#lib/favour-approval.js';
import {
	approveFavour,
	askParentToApprove,
	declineFavour,
} from '#lib/favours.remote.js';
import { invalidateAll } from '$app/navigation';

// The approval UI's actions (SB-80), wired to the remote functions. A
// success reloads the page data, so the card turns into its next state (or
// goes away); a failure rethrows the server's message for the card to show.

export const favourActions: FavourActions = {
	approve: async (completionId) => {
		await approveFavour({ completionId });
		await invalidateAll();
	},
	decline: async (completionId) => {
		await declineFavour({ completionId });
		await invalidateAll();
	},
	askParent: async (completionId) => {
		await askParentToApprove({ completionId });
		await invalidateAll();
	},
};
