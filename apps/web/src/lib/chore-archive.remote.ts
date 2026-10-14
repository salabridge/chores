import { error } from '@sveltejs/kit';
import {
	archiveChore as archiveChoreInHousehold,
	ChoreArchiveError,
	deleteChore as deleteChoreInHousehold,
	restoreChore as restoreChoreInHousehold,
} from '#lib/server/chore-archive.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { command } from '$app/server';
import { isUuid } from './rewards.ts';

// Remote functions for archiving, restoring and deleting chores (SB-61).
// Parent-only: the household comes from the caller's own profile, never from
// the request.

async function asHttpError<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof ChoreArchiveError) error(e.status, e.message);
		throw e;
	}
}

// Remote input is unchecked, so the id is validated here: a malformed uuid
// would otherwise be a Postgres error and a 500.
function choreIdOf(input: unknown): string {
	const value =
		typeof input === 'object' && input !== null
			? (input as Record<string, unknown>).choreId
			: undefined;
	if (!isUuid(value)) error(404, 'That chore was not found.');
	return value;
}

/** Removes a chore from everywhere it's done; history and points stay. */
export const archiveChore = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const { actor } = await requireParentProfile();
		const choreId = choreIdOf(input);
		await asHttpError(() =>
			archiveChoreInHousehold(actor.householdId, choreId),
		);
	},
);

/** Brings an archived chore back, from the next period. */
export const restoreChore = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const { actor } = await requireParentProfile();
		const choreId = choreIdOf(input);
		await asHttpError(() =>
			restoreChoreInHousehold(actor.householdId, choreId),
		);
	},
);

/** Permanently deletes a chore that has never been completed; 409 otherwise. */
export const deleteChore = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const { actor } = await requireParentProfile();
		const choreId = choreIdOf(input);
		await asHttpError(() => deleteChoreInHousehold(actor.householdId, choreId));
	},
);
