import { describe, expect, it } from 'vitest';
import {
	claimDenialMessage,
	costLabel,
	emptyRewardDraft,
	hasErrors,
	isUuid,
	milestoneRemaining,
	type RewardDraft,
	type RewardInput,
	rewardInputError,
	toRewardInput,
	validateRewardDraft,
} from './rewards.ts';

const valid = (o: Partial<RewardDraft> = {}): RewardDraft => ({
	...emptyRewardDraft(),
	title: '30 Min Screen Time',
	costPoints: '50',
	...o,
});

describe('validateRewardDraft', () => {
	it('requires a title', () => {
		expect(validateRewardDraft(valid({ title: '  ' })).title).toBeTruthy();
		expect(hasErrors(validateRewardDraft(valid()))).toBe(false);
	});

	it('needs a whole cost of at least 1 points', () => {
		for (const costPoints of ['', '0', '-5', '2.5', 'abc', '100001']) {
			expect(
				validateRewardDraft(valid({ costPoints })).costPoints,
			).toBeTruthy();
		}
		expect(
			validateRewardDraft(valid({ costPoints: ' 100000 ' })).costPoints,
		).toBeUndefined();
	});

	it('limits the description length', () => {
		expect(
			validateRewardDraft(valid({ description: 'x'.repeat(501) })).description,
		).toBeTruthy();
	});
});

describe('toRewardInput', () => {
	it('trims, nulls an empty description and parses the cost', () => {
		expect(
			toRewardInput(
				valid({ title: ' Movie Night ', description: '  ', costPoints: '120' }),
			),
		).toEqual({
			title: 'Movie Night',
			description: null,
			costPoints: 120,
			kind: 'personal',
			repeatable: false,
		});
	});

	it('never makes a family milestone repeatable', () => {
		const input = toRewardInput(
			valid({ kind: 'family_milestone', repeatable: true }),
		);
		expect(input.repeatable).toBe(false);
	});
});

describe('rewardInputError', () => {
	const input = (o: Partial<RewardInput> = {}): RewardInput => ({
		title: 'Sundaes on Sunday',
		description: null,
		costPoints: 300,
		kind: 'family_milestone',
		repeatable: false,
		...o,
	});

	it('accepts a valid reward', () => {
		expect(rewardInputError(input())).toBeNull();
	});

	it('rejects a repeatable milestone, an unknown kind and bad numbers', () => {
		expect(rewardInputError(input({ repeatable: true }))).toBeTruthy();
		expect(rewardInputError(input({ kind: 'other' as never }))).toBeTruthy();
		expect(rewardInputError(input({ costPoints: 0 }))).toBeTruthy();
		expect(rewardInputError(input({ costPoints: 1.5 }))).toBeTruthy();
		expect(rewardInputError(input({ title: '' }))).toBeTruthy();
	});

	it('rejects wrongly typed fields instead of throwing', () => {
		for (const bad of [
			null,
			'x',
			{ ...input(), title: 5 },
			{ ...input(), description: 5 },
			{ ...input(), costPoints: '50' },
			{ ...input(), repeatable: 'true' },
			{ ...input(), kind: 'personal', repeatable: undefined },
		]) {
			expect(rewardInputError(bad)).toBeTruthy();
		}
	});

	it('checks uuids', () => {
		expect(isUuid('2b8f6c1e-6a3c-4d0e-9c52-0a1b2c3d4e5f')).toBe(true);
		for (const bad of [
			'',
			'abc',
			5,
			null,
			'2b8f6c1e-6a3c-4d0e-9c52-0a1b2c3d4e5',
		]) {
			expect(isUuid(bad)).toBe(false);
		}
	});
});

describe('labels', () => {
	it('words the cost by kind', () => {
		expect(costLabel({ kind: 'personal', costPoints: 50 })).toBe('50 Points');
		expect(costLabel({ kind: 'family_milestone', costPoints: 300 })).toBe(
			'300 household points in a week',
		);
	});

	it('words milestone progress', () => {
		expect(milestoneRemaining(0, 4)).toBe('Unlocked this week');
		expect(milestoneRemaining(40, 1)).toContain('1 loop done');
		expect(milestoneRemaining(40, 2)).toContain('2 loops done');
	});

	it('words each claim denial', () => {
		for (const d of [
			'not_found',
			'not_claimable',
			'already_claimed',
			'insufficient_points',
		] as const) {
			expect(claimDenialMessage(d)).toBeTruthy();
		}
	});
});
