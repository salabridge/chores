import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	claimDenial,
	milestoneProgress,
	type RewardRules,
	rewardStatuses,
} from './rewards.ts';

const personal = (
	id: string,
	costPoints: number,
	repeatable = false,
): RewardRules => ({ id, kind: 'personal', costPoints, repeatable });
const milestone = (id: string, costPoints: number): RewardRules => ({
	id,
	kind: 'family_milestone',
	costPoints,
	repeatable: false,
});

const ctx = (balance: number, householdPoints = 0, claimed: string[] = []) => ({
	balance,
	householdPoints,
	claimedRewardIds: new Set(claimed),
});

test('a personal reward is earned once the balance covers its cost', () => {
	const s = rewardStatuses([personal('a', 50), personal('b', 100)], ctx(50));
	assert.equal(s.get('a'), 'earned');
	assert.equal(s.get('b'), 'locked');
});

test('a claimed non-repeatable reward is claimed, even with points to spare', () => {
	const s = rewardStatuses([personal('a', 50)], ctx(500, 0, ['a']));
	assert.equal(s.get('a'), 'claimed');
});

test('a claimed repeatable reward is earned or locked by the balance', () => {
	const r = personal('a', 50, true);
	assert.equal(rewardStatuses([r], ctx(60, 0, ['a'])).get('a'), 'earned');
	assert.equal(rewardStatuses([r], ctx(10, 0, ['a'])).get('a'), 'locked');
});

test('only the closest unmet milestone is next up', () => {
	const s = rewardStatuses(
		[milestone('far', 300), milestone('near', 150), milestone('done', 50)],
		ctx(0, 80),
	);
	assert.equal(s.get('done'), 'earned');
	assert.equal(s.get('near'), 'next_up');
	assert.equal(s.get('far'), 'locked');
});

test('no milestone is next up once all are reached', () => {
	const s = rewardStatuses([milestone('a', 50)], ctx(0, 50));
	assert.equal(s.get('a'), 'earned');
});

test('a milestone ignores the personal balance', () => {
	const s = rewardStatuses([milestone('a', 100)], ctx(1000, 10));
	assert.equal(s.get('a'), 'next_up');
});

test('milestone progress counts up to each target, lowest first', () => {
	const p = milestoneProgress([milestone('b', 200), milestone('a', 100)], 150);
	assert.deepEqual(p, [
		{
			id: 'a',
			target: 100,
			current: 100,
			remaining: 0,
			percent: 100,
			reached: true,
			nextUp: false,
		},
		{
			id: 'b',
			target: 200,
			current: 150,
			remaining: 50,
			percent: 75,
			reached: false,
			nextUp: true,
		},
	]);
});

test('milestone percent rounds down and negative weeks count as 0', () => {
	assert.equal(milestoneProgress([milestone('a', 200)], 199)[0]?.percent, 99);
	const p = milestoneProgress([milestone('a', 200)], -30)[0];
	assert.equal(p?.current, 0);
	assert.equal(p?.remaining, 200);
});

test('a member can claim an affordable, unclaimed reward', () => {
	assert.equal(
		claimDenial(personal('a', 50), { balance: 50, alreadyClaimed: false }),
		null,
	);
});

test('a member cannot claim a reward they cannot afford', () => {
	assert.equal(
		claimDenial(personal('a', 50), { balance: 49, alreadyClaimed: false }),
		'insufficient_points',
	);
});

test('a non-repeatable reward cannot be claimed twice', () => {
	assert.equal(
		claimDenial(personal('a', 50), { balance: 500, alreadyClaimed: true }),
		'already_claimed',
	);
});

test('a repeatable reward can be claimed again while affordable', () => {
	const r = personal('a', 50, true);
	assert.equal(claimDenial(r, { balance: 50, alreadyClaimed: true }), null);
	assert.equal(
		claimDenial(r, { balance: 49, alreadyClaimed: true }),
		'insufficient_points',
	);
});

test('family milestones and missing rewards cannot be claimed', () => {
	assert.equal(
		claimDenial(milestone('a', 10), { balance: 999, alreadyClaimed: false }),
		'not_claimable',
	);
	assert.equal(
		claimDenial(null, { balance: 999, alreadyClaimed: false }),
		'not_found',
	);
});
