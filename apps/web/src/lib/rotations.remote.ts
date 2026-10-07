import { error } from '@sveltejs/kit';
import { requireParentProfile } from '#lib/server/guards.js';
import {
	RotationLoopError,
	resetRotationLoop,
	saveRotationLoop,
} from '#lib/server/rotation-loops.js';
import { command } from '$app/server';
import type { SaveLoopInput } from './rotation-loops.ts';

// Remote functions for the Rotation Loops Builder (SB-50). Parent-only: the
// household comes from the caller's own profile, never from the request.

async function asBadRequest<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof RotationLoopError) error(400, e.message);
		throw e;
	}
}

/** Saves a loop's scope, eligibility, reasons, and order. */
export const saveLoop = command('unchecked', async (input: SaveLoopInput) => {
	const { actor } = await requireParentProfile();
	await asBadRequest(() => saveRotationLoop(actor.householdId, input));
});

/** Hands a loop's turn back to its first eligible member. */
export const resetLoop = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const { actor } = await requireParentProfile();
		await asBadRequest(() =>
			resetRotationLoop(actor.householdId, String(input.choreId)),
		);
	},
);
