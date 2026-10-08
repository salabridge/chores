import { describe, expect, it } from 'vitest';
import {
	addStage,
	type ChoreDraft,
	createInputError,
	emptyDraft,
	exampleDraft,
	frequencySummary,
	hasErrors,
	MAX_STAGES,
	moveStage,
	pointsHint,
	removeStage,
	stagesSummary,
	toCreateInput,
	validateDraft,
} from './chore-creator.ts';

const valid = (o: Partial<ChoreDraft> = {}): ChoreDraft => ({
	...emptyDraft(),
	title: 'Run Dishwasher',
	assigneeId: 'leo',
	...o,
});

describe('validateDraft', () => {
	it('requires a title', () => {
		expect(validateDraft(valid({ title: '   ' })).title).toBeTruthy();
		expect(hasErrors(validateDraft(valid()))).toBe(false);
	});

	it('requires an assignee for personal chores only', () => {
		expect(validateDraft(valid({ assigneeId: null })).assignee).toBeTruthy();
		expect(
			hasErrors(validateDraft(valid({ kind: 'rotation', assigneeId: null }))),
		).toBe(false);
	});

	it('needs at least one stage once stages are on', () => {
		expect(
			validateDraft(valid({ useStages: true, stages: [] })).stages,
		).toBeTruthy();
		// Stale rows are ignored while stages are off.
		const off = valid({
			useStages: false,
			stages: [{ key: 'a', title: '', hint: '' }],
		});
		expect(hasErrors(validateDraft(off))).toBe(false);
	});

	it('requires a title on every stage', () => {
		const draft = valid({
			useStages: true,
			stages: [
				{ key: 'a', title: 'Load it', hint: '' },
				{ key: 'b', title: ' ', hint: '' },
			],
		});
		const errors = validateDraft(draft);
		expect(errors.stage.a).toBeUndefined();
		expect(errors.stage.b?.title).toBeTruthy();
	});

	it('takes the presets and any non-negative whole number of points', () => {
		expect(hasErrors(validateDraft(valid({ points: 0 })))).toBe(false);
		expect(validateDraft(valid({ points: -5 })).points).toBeTruthy();
		expect(validateDraft(valid({ points: 2.5 })).points).toBeTruthy();
	});
});

describe('stage list', () => {
	const stages = [
		{ key: 'a', title: 'A', hint: '' },
		{ key: 'b', title: 'B', hint: '' },
		{ key: 'c', title: 'C', hint: '' },
	];
	const keys = (list: { key: string }[]) => list.map((s) => s.key);

	it('adds, removes, and caps the list', () => {
		expect(addStage([])).toHaveLength(1);
		expect(keys(removeStage(stages, 'b'))).toEqual(['a', 'c']);
		const full = Array.from({ length: MAX_STAGES }, (_, i) => ({
			key: String(i),
			title: 'x',
			hint: '',
		}));
		expect(addStage(full)).toHaveLength(MAX_STAGES);
	});

	it('moves a stage and stops at the ends', () => {
		expect(keys(moveStage(stages, 'b', 'up'))).toEqual(['b', 'a', 'c']);
		expect(keys(moveStage(stages, 'a', 'up'))).toEqual(['a', 'b', 'c']);
		expect(keys(moveStage(stages, 'c', 'down'))).toEqual(['a', 'b', 'c']);
	});
});

describe('summaries', () => {
	it('reads like the Figma badge', () => {
		expect(frequencySummary({ frequency: 'daily', points: 15 })).toBe(
			'Daily • 15 pts',
		);
		expect(frequencySummary({ frequency: 'weekends', points: 5 })).toBe(
			'Weekends • 5 pts',
		);
	});

	it('mentions the single award when stages are on', () => {
		expect(pointsHint({ frequency: 'daily', useStages: true })).toContain(
			'once, after the last stage',
		);
		expect(pointsHint({ frequency: 'weekly', useStages: false })).toContain(
			'Weekly chores',
		);
	});

	it('counts stages and total points', () => {
		expect(stagesSummary(exampleDraft())).toBe('3 stages, 15 total points');
		expect(stagesSummary(valid({ points: 10 }))).toBe(
			'Single step, 10 total points',
		);
	});
});

describe('Review Example', () => {
	it('is a complete, valid rotation chore with no per-stage points', () => {
		const example = exampleDraft();
		expect(example.kind).toBe('rotation');
		expect(example.stages).toHaveLength(3);
		expect(hasErrors(validateDraft(example))).toBe(false);
		expect(example.stages.every((s) => !('points' in s))).toBe(true);
	});
});

describe('toCreateInput', () => {
	it('trims, nulls empty values, and drops stages while they are off', () => {
		const input = toCreateInput(
			valid({
				title: '  Run Dishwasher ',
				note: '  ',
				useStages: false,
				stages: [{ key: 'a', title: 'stale', hint: '' }],
			}),
		);
		expect(input).toEqual({
			title: 'Run Dishwasher',
			note: null,
			kind: 'personal',
			frequency: 'daily',
			points: 10,
			assigneeId: 'leo',
			stages: [],
		});
	});

	it('keeps stage order and hints, and clears the assignee for rotations', () => {
		const input = toCreateInput(
			valid({
				kind: 'rotation',
				useStages: true,
				stages: [
					{ key: 'a', title: ' First ', hint: ' careful ' },
					{ key: 'b', title: 'Second', hint: '' },
				],
			}),
		);
		expect(input.assigneeId).toBeNull();
		expect(input.stages).toEqual([
			{ title: 'First', hint: 'careful' },
			{ title: 'Second', hint: null },
		]);
	});
});

describe('createInputError', () => {
	const input = () => toCreateInput(valid());

	it('accepts what the form produces', () => {
		expect(createInputError(input())).toBeNull();
	});

	it('rejects the same things the form does', () => {
		expect(createInputError({ ...input(), title: ' ' })).toBeTruthy();
		expect(createInputError({ ...input(), assigneeId: null })).toBeTruthy();
		expect(
			createInputError({ ...input(), frequency: 'hourly' as never }),
		).toBeTruthy();
		expect(
			createInputError({ ...input(), stages: [{ title: '', hint: null }] }),
		).toBeTruthy();
		expect(createInputError({ ...input(), points: -1 })).toBeTruthy();
	});
});
