import { error } from '@sveltejs/kit';
import {
	ChoreActionError,
	remindChore,
	skipChore,
} from '#lib/server/chore-actions.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { command } from '$app/server';

// Remote functions for the Overview's Skip and Remind actions (SB-29).
// Parent-only: the household comes from the caller's own profile, never from
// the request.

async function asHttpError<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof ChoreActionError) error(e.status, e.message);
		throw e;
	}
}

/** Skips a chore without points: a rotation moves on, a personal chore is skipped for today. */
export const skipChoreAction = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const state = await requireParentProfile();
		return asHttpError(() => skipChore(state, String(input.choreId)));
	},
);

/** Nudges whoever holds a chore; they see it on their Today screen. */
export const remindChoreAction = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const state = await requireParentProfile();
		return asHttpError(() => remindChore(state, String(input.choreId)));
	},
);
