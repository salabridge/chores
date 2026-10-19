import { error } from '@sveltejs/kit';
import {
	askParentToApprove as askParent,
	decideFavour,
	FavourError,
} from '#lib/server/favours.js';
import { requireProfile } from '#lib/server/guards.js';
import { command } from '$app/server';

// Remote functions for favour approval (SB-79). Who is acting comes from the
// caller's own profile (the active kid, or themselves), never from the
// request; the database decides who may approve, decline or ask a parent:
//
// - approve / decline: the member whose chore it is (their login, or their
//   profile on the shared device), or a parent in their own view. Never the
//   member who did it.
// - ask a parent: only the member who did it.

async function asHttpError<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof FavourError) error(e.status, e.message);
		throw e;
	}
}

/** "Yes, it's done": the doer gets the points and a rotation turn moves on. */
export const approveFavour = command(
	'unchecked',
	async (input: { completionId: string }) => {
		const state = await requireProfile();
		return asHttpError(() =>
			decideFavour(state, String(input?.completionId), true),
		);
	},
);

/** "Not done": no points, and the chore is open again for its owner. */
export const declineFavour = command(
	'unchecked',
	async (input: { completionId: string }) => {
		const state = await requireProfile();
		return asHttpError(() =>
			decideFavour(state, String(input?.completionId), false),
		);
	},
);

/** "Ask a parent": from now on only a parent can decide the favour. */
export const askParentToApprove = command(
	'unchecked',
	async (input: { completionId: string }) => {
		const state = await requireProfile();
		return asHttpError(() => askParent(state, String(input?.completionId)));
	},
);
