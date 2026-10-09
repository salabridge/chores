import { error } from '@sveltejs/kit';
import { getCurrentMember, requireParentProfile } from '#lib/server/guards.js';
import {
	claimReward as claimRewardForMember,
	createReward as createRewardForHousehold,
	deleteReward as deleteRewardFromHousehold,
	RewardError,
	updateReward as updateRewardInHousehold,
} from '#lib/server/rewards.js';
import { command } from '$app/server';
import type { RewardInput } from './rewards.ts';

// Remote functions for rewards (SB-27). The catalog is parent-only; claiming is
// for the member the request acts as. The household always comes from the
// caller's own profile, never from the request.

async function asBadRequest<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof RewardError) error(400, e.message);
		throw e;
	}
}

/** Adds a reward to the household's catalog and returns its id. */
export const createReward = command('unchecked', async (input: RewardInput) => {
	const { actor } = await requireParentProfile();
	return asBadRequest(() => createRewardForHousehold(actor, input));
});

export const updateReward = command(
	'unchecked',
	async (input: { id: string; reward: RewardInput }) => {
		const { actor } = await requireParentProfile();
		await asBadRequest(() =>
			updateRewardInHousehold(
				actor.householdId,
				String(input.id),
				input.reward,
			),
		);
	},
);

export const deleteReward = command(
	'unchecked',
	async (input: { id: string }) => {
		const { actor } = await requireParentProfile();
		await asBadRequest(() =>
			deleteRewardFromHousehold(actor.householdId, String(input.id)),
		);
	},
);

/**
 * Claims a reward for the member the request acts as (a kid profile's kid, or
 * the signed-in user). 400 with the reason when it can't be claimed.
 */
export const claimReward = command(
	'unchecked',
	async (input: { rewardId: string }) => {
		const member = await getCurrentMember();
		return asBadRequest(() =>
			claimRewardForMember(member, String(input.rewardId)),
		);
	},
);
