import { error } from '@sveltejs/kit';
import {
	ChoreError,
	createPersonalChore,
	createRotationChore,
	updateChoreFromInput,
} from '#lib/server/chores.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { command } from '$app/server';
import type { CreateChoreInput, UpdateChoreInput } from './chore-creator.ts';
import type { CreateRotationChoreInput } from './chore-eligibility.ts';

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
			if (e instanceof ChoreError) error(e.status, e.message);
			throw e;
		}
	},
);

/** Creates a household rotation chore with its stages and rotation members in one transaction. */
export const createRotation = command(
	'unchecked',
	async (input: CreateRotationChoreInput) => {
		const { actor } = await requireParentProfile();
		try {
			return await createRotationChore(actor, input);
		} catch (e) {
			if (e instanceof ChoreError) error(e.status, e.message);
			throw e;
		}
	},
);

/**
 * Saves changes to an existing chore (SB-63). The chore is looked up in the
 * caller's household, so an id from another household is a 404, and a save
 * from a stale form is a 409.
 */
export const updateChore = command(
	'unchecked',
	async (input: UpdateChoreInput) => {
		const { actor } = await requireParentProfile();
		try {
			return await updateChoreFromInput(actor, input);
		} catch (e) {
			if (e instanceof ChoreError) error(e.status, e.message);
			throw e;
		}
	},
);
