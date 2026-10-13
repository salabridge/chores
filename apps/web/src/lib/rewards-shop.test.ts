import { milestoneProgress } from '@chore/db/rewards';
import { describe, expect, it } from 'vitest';
import {
	loopsToEarn,
	milestoneNote,
	nextStreakGoal,
	type ShopData,
	type ShopReward,
	shapeRewardsShop,
} from './rewards-shop.ts';

const reward = (o: Partial<ShopReward> & { id: string }): ShopReward => ({
	title: o.id,
	description: null,
	costPoints: 50,
	kind: 'personal',
	repeatable: false,
	status: 'locked',
	...o,
});

const shopOf = (
	rewards: ShopReward[],
	week = { points: 140, loopsCompleted: 7 },
): ShopData => ({
	balance: 140,
	week,
	rewards,
	milestones: milestoneProgress(
		rewards.filter((r) => r.kind === 'family_milestone'),
		week.points,
	),
});

describe('nextStreakGoal', () => {
	it('picks the smallest goal above the streak', () => {
		expect(nextStreakGoal(0)).toBe(3);
		expect(nextStreakGoal(3)).toBe(4);
		expect(nextStreakGoal(6)).toBe(7);
		expect(nextStreakGoal(14)).toBe(21);
	});

	it('keeps going in steps of 50 past the last goal', () => {
		expect(nextStreakGoal(100)).toBe(150);
		expect(nextStreakGoal(149)).toBe(150);
	});
});

describe('loopsToEarn', () => {
	it('uses this week average points per loop, rounded up', () => {
		// 140 points over 7 loops is 20 a loop.
		expect(loopsToEarn(10, { points: 140, loopsCompleted: 7 })).toBe(1);
		expect(loopsToEarn(41, { points: 140, loopsCompleted: 7 })).toBe(3);
	});

	it('is null with nothing to average over or nothing to earn', () => {
		expect(loopsToEarn(10, { points: 0, loopsCompleted: 0 })).toBeNull();
		expect(loopsToEarn(0, { points: 140, loopsCompleted: 7 })).toBeNull();
	});
});

describe('milestoneNote', () => {
	const week = { points: 140, loopsCompleted: 7 };

	it('gives points and loops', () => {
		expect(milestoneNote({ reached: false, remaining: 10 }, week)).toBe(
			'10 more points or 1 shared loop away.',
		);
	});

	it('gives only points before any loop is done', () => {
		expect(
			milestoneNote(
				{ reached: false, remaining: 1 },
				{ points: 0, loopsCompleted: 0 },
			),
		).toBe('1 more point to go.');
	});

	it('says unlocked when reached', () => {
		expect(milestoneNote({ reached: true, remaining: 0 }, week)).toBe(
			'Unlocked this week.',
		);
	});
});

describe('shapeRewardsShop', () => {
	const rewards = [
		reward({ id: 'screen', title: '30 Min Screen Time', status: 'claimed' }),
		reward({ id: 'movie', costPoints: 80, status: 'earned' }),
		reward({ id: 'trip', costPoints: 500, status: 'locked' }),
		reward({
			id: 'sundae',
			kind: 'family_milestone',
			costPoints: 150,
			status: 'locked',
		}),
	];

	const view = shapeRewardsShop({
		shop: shopOf(rewards),
		streakDays: 3,
		suggested: [{ id: 'c1', title: 'Recycling' }],
	});

	it('passes the balance and household numbers through', () => {
		expect(view.balance).toBe(140);
		expect(view.household).toMatchObject({ loops: 7, points: 140 });
	});

	it('says how many loops unlock the next family reward', () => {
		expect(view.household.summary).toBe(
			'1 more loop unlock the next family reward.',
		);
	});

	it('works out the streak goal, loops left and percent', () => {
		expect(view.momentum).toMatchObject({
			days: 3,
			goal: 4,
			loopsLeft: 1,
			percent: 75,
		});
		expect(view.momentum.message).toContain('4-day personal streak');
	});

	it('links suggested chores to /chores/[id]', () => {
		expect(view.momentum.chores).toEqual([
			{ id: 'c1', title: 'Recycling', href: '/chores/c1' },
		]);
	});

	it('lists claimable rewards before claimed ones, with a confirm link', () => {
		expect(view.earned.map((r) => [r.id, r.status])).toEqual([
			['movie', 'claimable'],
			['screen', 'claimed'],
		]);
		expect(view.earned[0]?.claimHref).toBe('/rewards?confirm=movie');
	});

	it('keeps unaffordable personal rewards under saving, and milestones out of both', () => {
		expect(view.saving.map((r) => r.id)).toEqual(['trip']);
		expect(view.saving[0]?.status).toBe('locked');
		expect(view.earned.some((r) => r.id === 'sundae')).toBe(false);
	});

	it('shapes the milestone with progress and a note', () => {
		expect(view.milestones).toEqual([
			{
				id: 'sundae',
				title: 'sundae',
				description: null,
				current: 140,
				target: 150,
				percent: 93,
				reached: false,
				nextUp: true,
				note: '10 more points or 1 shared loop away.',
			},
		]);
	});

	it('caps the chips at four', () => {
		const many = shapeRewardsShop({
			shop: shopOf([]),
			streakDays: 0,
			suggested: Array.from({ length: 6 }, (_, i) => ({
				id: `c${i}`,
				title: `Chore ${i}`,
			})),
		});
		expect(many.momentum.chores).toHaveLength(4);
	});

	it('handles an empty household and a zero streak', () => {
		const empty = shapeRewardsShop({
			shop: shopOf([], { points: 0, loopsCompleted: 0 }),
			streakDays: 0,
			suggested: [],
		});
		expect(empty.household.summary).toBe('No family rewards are set up yet.');
		expect(empty.momentum.message).toBe(
			'Finish a loop today to start a streak.',
		);
		expect(empty.momentum.percent).toBe(0);
		expect(empty.earned).toEqual([]);
		expect(empty.milestones).toEqual([]);
	});

	it('says every reward is unlocked once all milestones are reached', () => {
		const done = shapeRewardsShop({
			shop: shopOf(
				[reward({ id: 'm', kind: 'family_milestone', costPoints: 100 })],
				{ points: 160, loopsCompleted: 8 },
			),
			streakDays: 1,
			suggested: [],
		});
		expect(done.household.summary).toBe(
			'Every family reward is unlocked this week.',
		);
		expect(done.milestones[0]).toMatchObject({
			reached: true,
			note: 'Unlocked this week.',
		});
	});
});
