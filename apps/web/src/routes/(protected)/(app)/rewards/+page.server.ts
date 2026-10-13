import { fail, redirect } from '@sveltejs/kit';
import { isUuid } from '#lib/rewards.js';
import { requireProfile } from '#lib/server/guards.js';
import { claimReward, RewardError } from '#lib/server/rewards.js';
import { loadRewardsShop } from '#lib/server/rewards-shop.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const { member } = await requireProfile();
	const shop = await loadRewardsShop(member);

	// "Claim" links to ?confirm=<id>, so the confirmation step works without
	// JavaScript. Only a reward that can be claimed right now is confirmed.
	const confirmId = url.searchParams.get('confirm');
	const confirming = shop.earned.find(
		(r) => r.id === confirmId && r.status === 'claimable',
	);
	const claimedId = url.searchParams.get('claimed');
	const claimed = shop.earned.find((r) => r.id === claimedId);

	return {
		shop,
		confirming: confirming ?? null,
		claimedTitle: claimed?.title ?? null,
	};
};

export const actions: Actions = {
	/**
	 * Spends points on a personal reward for the member the device is acting
	 * as. `claimReward` is atomic in the database, so a double-submit or a race
	 * can't spend twice on a one-time reward or take the balance below zero.
	 */
	claim: async ({ request }) => {
		const { member } = await requireProfile();
		const rewardId = (await request.formData()).get('rewardId');
		if (!isUuid(rewardId)) {
			return fail(404, {
				rewardId: null,
				message: 'That reward was not found.',
			});
		}
		try {
			await claimReward(member, rewardId);
		} catch (e) {
			if (e instanceof RewardError) {
				return fail(e.denial === 'not_found' ? 404 : 409, {
					rewardId,
					message: e.message,
				});
			}
			throw e;
		}
		redirect(303, `/rewards?claimed=${rewardId}`);
	},
};
