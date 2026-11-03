import { describe, expect, it } from 'vitest';
import {
	addStage,
	type ChoreDraft,
	choreToDraft,
	createInputError,
	dueWeekdayFor,
	emptyDraft,
	exampleDraft,
	frequencySummary,
	hasErrors,
	MAX_STAGES,
	moveStage,
	pointsHint,
	removeStage,
	splitAcrossStages,
	splitPoints,
	stagePointsTotal,
	stagesSummary,
	toCreateInput,
	totalPoints,
	toUpdateInput,
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
			stages: [{ key: 'a', title: '', hint: '', points: 0 }],
		});
		expect(hasErrors(validateDraft(off))).toBe(false);
	});

	it('requires a title on every stage', () => {
		const draft = valid({
			useStages: true,
			stages: [
				{ key: 'a', title: 'Load it', hint: '', points: 0 },
				{ key: 'b', title: ' ', hint: '', points: 0 },
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
		{ key: 'a', title: 'A', hint: '', points: 0 },
		{ key: 'b', title: 'B', hint: '', points: 0 },
		{ key: 'c', title: 'C', hint: '', points: 0 },
	];
	const keys = (list: { key: string }[]) => list.map((s) => s.key);

	it('adds, removes, and caps the list', () => {
		expect(addStage([])).toHaveLength(1);
		expect(keys(removeStage(stages, 'b'))).toEqual(['a', 'c']);
		const full = Array.from({ length: MAX_STAGES }, (_, i) => ({
			key: String(i),
			title: 'x',
			hint: '',
			points: 0,
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

	it('names the due day of a weekly chore', () => {
		expect(
			frequencySummary({ frequency: 'weekly', dueWeekday: 4, points: 10 }),
		).toBe('Weekly · Thu • 10 pts');
		expect(
			frequencySummary({ frequency: 'weekly', dueWeekday: null, points: 10 }),
		).toBe('Weekly • 10 pts');
		// A day left over from before switching frequency isn't shown.
		expect(
			frequencySummary({ frequency: 'daily', dueWeekday: 4, points: 10 }),
		).toBe('Daily • 10 pts');
	});

	it('explains that each stage pays out when stages are on', () => {
		expect(pointsHint({ frequency: 'daily', useStages: true })).toContain(
			'each stage pays out as it is finished',
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
	it('is a complete, valid rotation chore whose points live on the stages', () => {
		const example = exampleDraft();
		expect(example.kind).toBe('rotation');
		expect(example.stages).toHaveLength(3);
		expect(hasErrors(validateDraft(example))).toBe(false);
		expect(example.points).toBe(0);
		expect(example.stages.map((s) => s.points)).toEqual([5, 5, 5]);
	});
});

describe('toCreateInput', () => {
	it('trims, nulls empty values, and drops stages while they are off', () => {
		const input = toCreateInput(
			valid({
				title: '  Run Dishwasher ',
				note: '  ',
				useStages: false,
				stages: [{ key: 'a', title: 'stale', hint: '', points: 0 }],
			}),
		);
		expect(input).toEqual({
			title: 'Run Dishwasher',
			note: null,
			kind: 'personal',
			frequency: 'daily',
			dueWeekday: null,
			points: 10,
			assigneeId: 'leo',
			stages: [],
		});
	});

	it('sends the due day only for a weekly chore', () => {
		expect(
			toCreateInput(valid({ frequency: 'weekly', dueWeekday: 4 })).dueWeekday,
		).toBe(4);
		expect(
			toCreateInput(valid({ frequency: 'weekly', dueWeekday: null }))
				.dueWeekday,
		).toBeNull();
		// Switching a weekly chore to daily or weekends clears it.
		expect(
			toCreateInput(valid({ frequency: 'daily', dueWeekday: 4 })).dueWeekday,
		).toBeNull();
		expect(
			toCreateInput(valid({ frequency: 'weekends', dueWeekday: 6 })).dueWeekday,
		).toBeNull();
	});

	it('keeps stage order and hints, and clears the assignee for rotations', () => {
		const input = toCreateInput(
			valid({
				kind: 'rotation',
				useStages: true,
				stages: [
					{ key: 'a', title: ' First ', hint: ' careful ', points: 0 },
					{ key: 'b', title: 'Second', hint: '', points: 0 },
				],
			}),
		);
		expect(input.assigneeId).toBeNull();
		expect(input.stages).toEqual([
			{ title: 'First', hint: 'careful', points: 0 },
			{ title: 'Second', hint: null, points: 0 },
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
			createInputError({
				...input(),
				stages: [{ title: '', hint: null, points: 0 }],
			}),
		).toBeTruthy();
		expect(createInputError({ ...input(), points: -1 })).toBeTruthy();
	});

	it('accepts a due day from 1 to 7 and rejects anything else', () => {
		const weekly = { ...input(), frequency: 'weekly' as const };
		expect(createInputError({ ...weekly, dueWeekday: 1 })).toBeNull();
		expect(createInputError({ ...weekly, dueWeekday: 7 })).toBeNull();
		expect(createInputError({ ...weekly, dueWeekday: 0 as never })).toBe(
			'Choose a day of the week, or Any day.',
		);
		expect(
			createInputError({ ...weekly, dueWeekday: 8 as never }),
		).toBeTruthy();
		expect(
			createInputError({ ...weekly, dueWeekday: '4' as never }),
		).toBeTruthy();
	});
});

describe('dueWeekdayFor', () => {
	it('keeps a valid day only on weekly chores', () => {
		expect(dueWeekdayFor('weekly', 4)).toBe(4);
		expect(dueWeekdayFor('weekly', null)).toBeNull();
		expect(dueWeekdayFor('weekly', 9)).toBeNull();
		expect(dueWeekdayFor('daily', 4)).toBeNull();
		expect(dueWeekdayFor('weekends', 7)).toBeNull();
	});
});

describe('choreToDraft / toUpdateInput', () => {
	const saved = {
		title: 'Clean Your Room',
		description: null,
		type: 'personal' as const,
		frequency: 'weekly' as const,
		dueWeekday: 4,
		points: 15,
		assignedMemberId: 'leo',
		stages: [
			{ id: 's1', title: 'Toys', hint: 'Bins', points: 0 },
			{ id: 's2', title: 'Dust', hint: null, points: 0 },
		],
	};

	it('loads a saved chore with each stage keyed by its id', () => {
		const draft = choreToDraft(saved);
		expect(draft).toMatchObject({
			title: 'Clean Your Room',
			note: '',
			kind: 'personal',
			useStages: true,
			frequency: 'weekly',
			dueWeekday: 4,
			points: 15,
			assigneeId: 'leo',
		});
		expect(draft.stages.map((s) => [s.key, s.id, s.hint])).toEqual([
			['s1', 's1', 'Bins'],
			['s2', 's2', ''],
		]);
	});

	it('has no assignee for a rotation and no stages for a single step', () => {
		const draft = choreToDraft({
			...saved,
			type: 'rotation',
			assignedMemberId: 'leo',
			stages: [],
		});
		expect(draft.assigneeId).toBeNull();
		expect(draft.useStages).toBe(false);
	});

	it('sends saved stages with their ids and new ones without', () => {
		const draft = choreToDraft(saved);
		draft.stages = [
			draft.stages[1],
			{ key: 'stage-new', title: ' Vacuum ', hint: '', points: 0 },
		];
		const input = toUpdateInput(draft, 'c1', '2026-10-13T00:00:00.000Z');
		expect(input).toMatchObject({
			choreId: 'c1',
			updatedAt: '2026-10-13T00:00:00.000Z',
		});
		expect(input.stages).toEqual([
			{ id: 's2', title: 'Dust', hint: null, points: 0 },
			{ id: null, title: 'Vacuum', hint: null, points: 0 },
		]);
		expect(createInputError(input)).toBeNull();
	});
});

describe('splitPoints', () => {
	it('splits evenly when it divides', () => {
		expect(splitPoints(30, 3)).toEqual([10, 10, 10]);
	});

	it('gives the remainder to the earliest stages, one point each', () => {
		expect(splitPoints(50, 3)).toEqual([17, 17, 16]);
		expect(splitPoints(10, 4)).toEqual([3, 3, 2, 2]);
		expect(splitPoints(2, 5)).toEqual([1, 1, 0, 0, 0]);
	});

	it('always adds back up to the total', () => {
		for (let total = 0; total <= 60; total++) {
			for (let n = 1; n <= 12; n++) {
				expect(splitPoints(total, n).reduce((a, b) => a + b, 0)).toBe(total);
			}
		}
	});

	it('is empty with no stages and zero for a bad total', () => {
		expect(splitPoints(50, 0)).toEqual([]);
		expect(splitPoints(-5, 2)).toEqual([0, 0]);
		expect(splitPoints(2.5, 2)).toEqual([0, 0]);
	});
});

describe('stage points', () => {
	const stage = (key: string, points: number) => ({
		key,
		title: key,
		hint: '',
		points,
	});

	it('splitAcrossStages overwrites each stage and keeps the rest', () => {
		const out = splitAcrossStages(
			[stage('a', 0), stage('b', 9), stage('c', 1)],
			50,
		);
		expect(out.map((s) => s.points)).toEqual([17, 17, 16]);
		expect(out.map((s) => s.key)).toEqual(['a', 'b', 'c']);
	});

	it('totals the stages, ignoring invalid values', () => {
		expect(stagePointsTotal([stage('a', 5), stage('b', 7)])).toBe(12);
		expect(stagePointsTotal([stage('a', Number.NaN), stage('b', -3)])).toBe(0);
	});

	it('totalPoints is the chore bonus plus the stages only while stages are on', () => {
		const stages = [stage('a', 5), stage('b', 5)];
		expect(totalPoints({ points: 3, useStages: true, stages })).toBe(13);
		expect(totalPoints({ points: 3, useStages: false, stages })).toBe(3);
		expect(totalPoints({ points: 3 })).toBe(3);
	});

	it('rejects a stage with fractional or negative points', () => {
		for (const points of [-1, 1.5, Number.NaN]) {
			const errors = validateDraft(
				valid({
					useStages: true,
					stages: [{ ...stage('a', points), title: 'Go' }],
				}),
			);
			expect(errors.stage.a?.points).toBeTruthy();
		}
		expect(
			hasErrors(
				validateDraft(
					valid({
						useStages: true,
						stages: [{ ...stage('a', 0), title: 'Go' }],
					}),
				),
			),
		).toBe(false);
	});

	it('summaries show the chore total, bonus plus stages', () => {
		const draft = valid({
			useStages: true,
			points: 0,
			stages: [stage('a', 17), stage('b', 17), stage('c', 16)],
		});
		expect(frequencySummary(draft)).toContain('50 pts');
		expect(stagesSummary(draft)).toBe('3 stages, 50 total points');
	});

	it('the create and edit inputs carry each stage its points', () => {
		const draft = valid({
			useStages: true,
			points: 0,
			stages: [
				{ ...stage('a', 5), title: 'One' },
				{ ...stage('b', 4), title: 'Two' },
			],
		});
		expect(toCreateInput(draft).stages.map((s) => s.points)).toEqual([5, 4]);
		expect(
			toUpdateInput(draft, 'c1', '2026-01-01T00:00:00Z').stages.map(
				(s) => s.points,
			),
		).toEqual([5, 4]);
		expect(createInputError(toCreateInput(draft))).toBeNull();
		expect(
			createInputError({
				...toCreateInput(draft),
				stages: [{ title: 'One', hint: null, points: -2 }],
			}),
		).toBeTruthy();
	});
});
