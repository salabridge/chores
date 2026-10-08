import { error } from '@sveltejs/kit';
import { ChoreError, createPersonalChore } from '#lib/server/chores.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { command } from '$app/server';
import type { CreateChoreInput } from './chore-creator.ts';

// Remote functions for the Chore Creator (SB-48). Parent-only: the household
// comes from the caller's own profile, never from the request.

/** Creates a personal chore (with its stages) and returns its id. */
export const createChore = command(
	'unchecked',
	async (input: CreateChoreInput) => {
		const { actor } = await requireParentProfile();
		try {
			return await createPersonalChore(actor, input);
		} catch (e) {
			if (e instanceof ChoreError) error(400, e.message);
			throw e;
		}
	},
);
