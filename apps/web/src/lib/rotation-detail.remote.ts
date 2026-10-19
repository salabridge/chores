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
// from the request. The member whose turn it is completes it; anyone else in
// the household completing it does it for them and gets the points (SB-74).
// `doneBy` is only for a parent in their own view recording that another
// member did it; the server checks it.

async function asHttpError<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof RotationDetailError) error(e.status, e.message);
		throw e;
	}
}

const doer = (input: { doneBy?: string | null }) =>
	input.doneBy ? { doneBy: String(input.doneBy) } : {};

/** Completes the current turn: awards the points and advances the loop. */
export const completeTurn = command(
	'unchecked',
	async (input: { choreId: string; doneBy?: string | null }) => {
		const state = await requireProfile();
		return asHttpError(() =>
			completeRotationTurn(state, String(input.choreId), doer(input)),
		);
	},
);

/** Checks off one stage of a staged rotation; the last one completes the turn. */
export const completeStage = command(
	'unchecked',
	async (input: {
		choreId: string;
		stageId: string;
		doneBy?: string | null;
	}) => {
		const state = await requireProfile();
		return asHttpError(() =>
			completeRotationStage(
				state,
				String(input.choreId),
				String(input.stageId),
				doer(input),
			),
		);
	},
);
