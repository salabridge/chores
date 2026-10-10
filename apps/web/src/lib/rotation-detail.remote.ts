import { error } from '@sveltejs/kit';
import { requireProfile } from '#lib/server/guards.js';
import {
	completeRotationStage,
	completeRotationTurn,
	RotationDetailError,
} from '#lib/server/rotation-detail.js';
import { command } from '$app/server';

// Remote functions for the shared rotation chore screen (SB-41). The member
// comes from the caller's own profile (the active kid, or themselves), never
// from the request, and the server only lets the member whose turn it is act.

async function asHttpError<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof RotationDetailError) error(e.status, e.message);
		throw e;
	}
}

/** Completes the current member's turn: awards the points and advances the loop. */
export const completeTurn = command(
	'unchecked',
	async (input: { choreId: string }) => {
		const state = await requireProfile();
		return asHttpError(() =>
			completeRotationTurn(state, String(input.choreId)),
		);
	},
);

/** Checks off one stage of a staged rotation; the last one completes the turn. */
export const completeStage = command(
	'unchecked',
	async (input: { choreId: string; stageId: string }) => {
		const state = await requireProfile();
		return asHttpError(() =>
			completeRotationStage(
				state,
				String(input.choreId),
				String(input.stageId),
			),
		);
	},
);
