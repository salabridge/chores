import { isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The claim action decides what to tell the caller; the atomic spend and the
// limits themselves are claimReward's and the database's (see rewards.ts), so
// that is stubbed here and fed the denials it would throw.
const mocks = vi.hoisted(() => {
	class RewardError extends Error {
		denial: string | null;
		constructor(message: string, denial: string | null = null) {
			super(message);
			this.denial = denial;
		}
	}
	return {
		RewardError,
		claimReward: vi.fn(),
		listRecentGifts: vi.fn(),
		loadRewardsShop: vi.fn(),
		requireProfile: vi.fn(),
	};
});

vi.mock('#lib/server/guards.js', () => ({
	requireProfile: mocks.requireProfile,
}));
vi.mock('#lib/server/gifts.js', () => ({
	listRecentGifts: mocks.listRecentGifts,
}));
vi.mock('#lib/server/rewards.js', () => ({
	claimReward: mocks.claimReward,
	RewardError: mocks.RewardError,
}));
vi.mock('#lib/server/rewards-shop.js', () => ({
	loadRewardsShop: mocks.loadRewardsShop,
}));

const { actions, load } = await import('./+page.server.ts');

const member = { id: 'm1', householdId: 'h1' };
const REWARD_ID = '11111111-1111-4111-8111-111111111111';

const claim = (rewardId?: string) => {
	const body = new FormData();
	if (rewardId !== undefined) body.set('rewardId', rewardId);
	return actions.claim?.({
		request: new Request('http://x/rewards?/claim', { method: 'POST', body }),
	} as never);
};

beforeEach(() => {
	vi.resetAllMocks();
	mocks.requireProfile.mockResolvedValue({ member });
});

describe('claim action', () => {
	it('claims for the acting member and redirects to the confirmation banner', async () => {
		mocks.claimReward.mockResolvedValue({ claimId: 'c1' });
		const thrown = await Promise.resolve(claim(REWARD_ID)).catch((e) => e);
		expect(isRedirect(thrown)).toBe(true);
		expect(thrown).toMatchObject({
			status: 303,
			location: `/rewards?claimed=${REWARD_ID}`,
		});
		expect(mocks.claimReward).toHaveBeenCalledWith(member, REWARD_ID);
	});

	it('fails with the message when points are insufficient', async () => {
		mocks.claimReward.mockRejectedValue(
			new mocks.RewardError(
				'You do not have enough points.',
				'insufficient_points',
			),
		);
		expect(await claim(REWARD_ID)).toMatchObject({
			status: 409,
			data: { rewardId: REWARD_ID, message: 'You do not have enough points.' },
		});
	});

	it('fails when the reward was already claimed', async () => {
		mocks.claimReward.mockRejectedValue(
			new mocks.RewardError(
				'You already claimed this reward.',
				'already_claimed',
			),
		);
		expect(await claim(REWARD_ID)).toMatchObject({
			status: 409,
			data: { message: 'You already claimed this reward.' },
		});
	});

	it('answers 404 for an unknown reward', async () => {
		mocks.claimReward.mockRejectedValue(
			new mocks.RewardError('That reward was not found.', 'not_found'),
		);
		expect(await claim(REWARD_ID)).toMatchObject({ status: 404 });
	});

	it('rejects a missing or malformed reward id without touching the database', async () => {
		expect(await claim()).toMatchObject({ status: 404 });
		expect(await claim('not-a-uuid')).toMatchObject({ status: 404 });
		expect(mocks.claimReward).not.toHaveBeenCalled();
	});

	it('does not swallow unexpected errors', async () => {
		mocks.claimReward.mockRejectedValue(new Error('db down'));
		await expect(claim(REWARD_ID)).rejects.toThrow('db down');
	});

	it('passes through the guard rejection (not in a household)', async () => {
		mocks.requireProfile.mockRejectedValue(new Error('Join a household'));
		await expect(claim(REWARD_ID)).rejects.toThrow('Join a household');
		expect(mocks.claimReward).not.toHaveBeenCalled();
	});
});

describe('load', () => {
	const item = (id: string, status: 'claimable' | 'claimed') => ({
		id,
		title: id,
		description: null,
		cost: 50,
		status,
		claimHref: `/rewards?confirm=${id}`,
	});
	const shop = {
		balance: 100,
		earned: [item('a', 'claimable'), item('b', 'claimed')],
	};
	const run = (search: string) =>
		(load as (event: never) => Promise<unknown>)({
			url: new URL(`http://x/rewards${search}`),
		} as never) as Promise<{
			shop: unknown;
			gifts: unknown;
			confirming: { id: string } | null;
			claimedTitle: string | null;
		}>;

	beforeEach(() => {
		mocks.loadRewardsShop.mockResolvedValue(shop);
		mocks.listRecentGifts.mockResolvedValue([]);
	});

	it('loads the shop for the acting member', async () => {
		const data = await run('');
		expect(mocks.loadRewardsShop).toHaveBeenCalledWith(member);
		expect(data.shop).toBe(shop);
		expect(data.confirming).toBeNull();
		expect(data.claimedTitle).toBeNull();
	});

	it('loads recent bonus points for the acting member', async () => {
		const gifts = [{ id: 'g1', points: 20, reason: 'Chores', fromName: 'Mom' }];
		mocks.listRecentGifts.mockResolvedValue(gifts);
		const data = await run('');
		expect(mocks.listRecentGifts).toHaveBeenCalledWith(member);
		expect(data.gifts).toBe(gifts);
	});

	it('confirms a reward that can be claimed now', async () => {
		expect((await run('?confirm=a')).confirming?.id).toBe('a');
	});

	it('ignores a confirm for a claimed or unknown reward', async () => {
		expect((await run('?confirm=b')).confirming).toBeNull();
		expect((await run('?confirm=zzz')).confirming).toBeNull();
	});

	it('names the reward that was just claimed', async () => {
		expect((await run('?claimed=b')).claimedTitle).toBe('b');
	});
});
