import { describe, expect, it } from 'vitest';
import {
	roomDetail,
	roomDone,
	roomLastStage,
	roomReadOnly,
	singleStepDetail,
} from './components/chores/fixtures.ts';
import {
	activeStageNumber,
	ctaLabel,
	doneStageCount,
	effectiveAssignee,
	introText,
	nextText,
	progressDescription,
	progressTitle,
	rewardSummary,
	stageLabel,
	waitingText,
} from './personal-detail.ts';

describe('personal detail copy', () => {
	it('numbers the stage being worked on', () => {
		expect(activeStageNumber(roomDetail)).toBe(2);
		expect(activeStageNumber(roomLastStage)).toBe(3);
		expect(activeStageNumber(roomDone)).toBeNull();
		expect(activeStageNumber(singleStepDetail)).toBeNull();
		expect(doneStageCount(roomDetail)).toBe(1);
	});

	it('describes the progress card', () => {
		expect(progressTitle('Room Clean')).toBe('Room Clean Progress');
		expect(progressDescription(roomDetail)).toBe(
			'Stage 2 of 3 is active right now',
		);
		expect(progressDescription(roomDone)).toBe('All 3 stages are done');
		expect(stageLabel(0, 'Put away toys')).toBe('Stage 1: Put away toys');
	});

	it('labels the button by where the member is', () => {
		expect(ctaLabel(roomDetail)).toBe('Complete Stage 2');
		expect(ctaLabel(roomLastStage)).toBe('Complete Chore');
		expect(ctaLabel(singleStepDetail)).toBe('Mark Done');
	});

	it('explains what happens next', () => {
		expect(nextText(roomDetail)).toBe(
			'Finish Stage 2 to unlock Stage 3. Complete all 3 stages to claim the full 15-point reward.',
		);
		expect(nextText(roomLastStage)).toContain('Finish Stage 3 to complete');
		expect(nextText(singleStepDetail)).toContain('Mark Done');
	});

	it('words the reward footer', () => {
		expect(rewardSummary(roomDetail)).toBe(
			'Reward after all 3 stages · 15 pts',
		);
		expect(rewardSummary(singleStepDetail)).toBe(
			'Reward for finishing · 10 pts',
		);
	});

	it("uses the parent's note, or a generated intro", () => {
		expect(introText(roomDetail)).toContain('three quick stages');
		expect(introText({ ...roomDetail, description: '  ' })).toBe(
			'Finish all 3 stages to earn 15 points.',
		);
		expect(introText(singleStepDetail)).toBe(
			'Finish this chore to earn 10 points.',
		);
	});

	it('says why the button is missing', () => {
		expect(waitingText(roomReadOnly)).toContain('Only Mia can complete');
		expect(waitingText({ ...roomDetail, completedThisPeriod: true })).toBe(
			'Done for now. Nice work!',
		);
		expect(waitingText({ ...roomReadOnly, completedThisPeriod: true })).toBe(
			'Mia finished this chore for now.',
		);
		expect(waitingText({ ...roomDetail, availableToday: false })).toBe(
			"This chore isn't due today.",
		);
	});
});

describe('effectiveAssignee', () => {
	it('keeps the instance assignee once work has started', () => {
		expect(
			effectiveAssignee({
				choreAssigneeId: 'mia',
				instanceAssigneeId: 'leo',
				touched: true,
			}),
		).toBe('leo');
	});

	it('follows a reassignment while the instance is untouched', () => {
		expect(
			effectiveAssignee({
				choreAssigneeId: 'mia',
				instanceAssigneeId: 'leo',
				touched: false,
			}),
		).toBe('mia');
	});

	it('falls back to whichever side has someone', () => {
		expect(
			effectiveAssignee({
				choreAssigneeId: null,
				instanceAssigneeId: 'leo',
				touched: false,
			}),
		).toBe('leo');
		expect(
			effectiveAssignee({
				choreAssigneeId: null,
				instanceAssigneeId: null,
				touched: false,
			}),
		).toBeNull();
	});
});
