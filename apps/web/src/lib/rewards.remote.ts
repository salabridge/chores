import { error } from '@sveltejs/kit';
import { getCurrentMember, requireParentProfile } from '#lib/server/guards.js';
import {
	archiveReward as archiveRewardInHousehold,
	claimReward as claimRewardForMember,
	createReward as createRewardForHousehold,
	RewardError,
	updateReward as updateRewardInHousehold,
} from '#lib/server/rewards.js';
import { command } from '$app/server';
import { isUuid, type RewardInput } from './rewards.ts';

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

// Remote input is unchecked, so ids are validated here (a malformed uuid would
// otherwise be a Postgres error and a 500); the reward itself is validated by
// the server functions.
function idOf(input: unknown, key: string): string {
	const value =
		typeof input === 'object' && input !== null
			? (input as Record<string, unknown>)[key]
			: undefined;
	if (!isUuid(value)) error(400, 'That reward was not found.');
	return value;
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
		const id = idOf(input, 'id');
		await asBadRequest(() =>
			updateRewardInHousehold(
				actor.householdId,
				id,
				(input as { reward: RewardInput }).reward,
			),
		);
	},
);

/** Removes a reward from the catalog (archives it; claims are kept). */
export const archiveReward = command(
	'unchecked',
	async (input: { id: string }) => {
		const { actor } = await requireParentProfile();
		const id = idOf(input, 'id');
		await asBadRequest(() => archiveRewardInHousehold(actor.householdId, id));
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
		const rewardId = idOf(input, 'rewardId');
		return asBadRequest(() => claimRewardForMember(member, rewardId));
	},
);
