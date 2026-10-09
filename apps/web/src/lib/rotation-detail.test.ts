import { describe, expect, it } from 'vitest';
import {
	dishwasherDetail,
	toiletDetail,
	toiletDone,
	toiletWaiting,
} from './components/rotations/fixtures.ts';
import {
	advanceText,
	COMPLETE_TURN_LABEL,
	ctaLabel,
	eligibilityText,
	howToText,
	introText,
	loopHeading,
	stageStates,
	waitingText,
} from './rotation-detail.ts';

describe('rotation detail copy', () => {
	it('names the loop after its scope label, or the household', () => {
		expect(loopHeading(toiletDetail)).toBe(
			'The Kids Shared Bathroom Rotation Loop',
		);
		expect(loopHeading({ scopeLabel: null })).toBe(
			'The Household Rotation Loop',
		);
	});

	it("uses the chore's own description, or a generated intro", () => {
		expect(introText({ ...toiletDetail, description: ' Scrub it. ' })).toBe(
			'Scrub it.',
		);
		expect(introText(toiletDetail)).toContain('Leo and Mia share it in order');
	});

	it('explains who is in and who is out, with reasons', () => {
		expect(eligibilityText(toiletDetail)).toBe(
			'Only Leo and Mia are included in this loop (Kids Shared Bathroom). Mom is excluded: parents are not part of this kids-only loop. Dad is excluded.',
		);
	});

	it('handles a loop with one eligible member', () => {
		const solo = { ...toiletDetail, members: [toiletDetail.members[0]] };
		expect(eligibilityText(solo)).toContain('Only Leo is included');
		expect(
			advanceText({ activeTurn: solo.members[0], nextUp: solo.members[0] }),
		).toContain('turn comes straight back');
	});

	it('says who becomes active next', () => {
		expect(advanceText(toiletDetail)).toBe(
			'The loop advances immediately after Leo completes this turn. Mia will become the next active member automatically.',
		);
	});

	it('tells the member how to complete, with and without stages', () => {
		expect(howToText(toiletDetail)).toContain('claim your 20 points');
		expect(howToText(toiletDetail)).toContain('pass the rotation to Mia');
		expect(howToText(dishwasherDetail)).toContain('Check off each stage');
	});

	it('labels the button generically, or by stage progress', () => {
		expect(ctaLabel(toiletDetail)).toBe(COMPLETE_TURN_LABEL);
		expect(ctaLabel(dishwasherDetail)).toBe('Finish stage 2 of 3');
		expect(
			ctaLabel({
				stages: dishwasherDetail.stages.map((s, i) => ({
					...s,
					state: i < 2 ? ('completed' as const) : ('current' as const),
				})),
			}),
		).toBe('Complete Chore');
	});

	it('words the waiting states', () => {
		expect(waitingText(toiletWaiting)).toBe("It's Mia's turn.");
		expect(waitingText(toiletDone)).toBe(
			'Done for now. Mia has the next turn.',
		);
		expect(waitingText({ ...toiletWaiting, availableToday: false })).toBe(
			"This chore isn't due today.",
		);
		expect(waitingText({ ...toiletWaiting, activeTurn: null })).toContain(
			'Nobody is eligible',
		);
	});

	it('marks done stages, then the first open one, then the rest locked', () => {
		const stages = [
			{ id: 'a', title: 'A', hint: null },
			{ id: 'b', title: 'B', hint: null },
			{ id: 'c', title: 'C', hint: null },
		];
		expect(stageStates(stages, new Set(['a'])).map((s) => s.state)).toEqual([
			'completed',
			'current',
			'locked',
		]);
		expect(stageStates(stages, new Set()).map((s) => s.state)).toEqual([
			'current',
			'locked',
			'locked',
		]);
	});
});
