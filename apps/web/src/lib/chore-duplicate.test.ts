import { describe, expect, it } from 'vitest';
import {
	archiveOriginalDefault,
	type DuplicateSource,
	duplicateDraft,
	duplicateHref,
	duplicateInfo,
	parseKind,
} from './chore-duplicate.ts';

const personal: DuplicateSource = {
	id: 'c1',
	title: 'Run Dishwasher',
	note: 'After dinner',
	kind: 'personal',
	frequency: 'weekly',
	dueWeekday: 4,
	points: 15,
	stages: [
		{ title: 'Load', hint: 'Plates first' },
		{ title: 'Start', hint: null },
	],
	assigneeId: 'leo',
	currentTurnMemberId: null,
};

const rotation: DuplicateSource = {
	...personal,
	id: 'c2',
	title: 'Bathroom',
	note: null,
	kind: 'rotation',
	stages: [],
	assigneeId: null,
	currentTurnMemberId: 'mia',
};

describe('duplicateDraft', () => {
	it('copies the fields and keeps the kind and assignee by default', () => {
		const draft = duplicateDraft(personal);
		expect(draft).toMatchObject({
			title: 'Run Dishwasher',
			note: 'After dinner',
			kind: 'personal',
			frequency: 'weekly',
			dueWeekday: 4,
			points: 15,
			useStages: true,
			assigneeId: 'leo',
		});
		expect(draft.stages.map((s) => [s.title, s.hint])).toEqual([
			['Load', 'Plates first'],
			['Start', ''],
		]);
		expect(new Set(draft.stages.map((s) => s.key)).size).toBe(2);
	});

	it('personal to rotation drops the assignee', () => {
		expect(duplicateDraft(personal, 'rotation')).toMatchObject({
			kind: 'rotation',
			assigneeId: null,
		});
	});

	it('rotation to personal suggests the member whose turn it is', () => {
		expect(duplicateDraft(rotation, 'personal')).toMatchObject({
			kind: 'personal',
			assigneeId: 'mia',
			note: '',
			useStages: false,
		});
	});

	it('a plain duplicate of a rotation has no assignee', () => {
		expect(duplicateDraft(rotation).assigneeId).toBeNull();
	});
});

describe('duplicateInfo and the checkbox default', () => {
	it('a kind change archives by default', () => {
		const info = duplicateInfo(personal, 'rotation');
		expect(info.kindChanges).toBe(true);
		expect(archiveOriginalDefault(info.kindChanges)).toBe(true);
	});

	it('same kind, or no kind, is a plain duplicate that leaves the original', () => {
		for (const kind of ['personal', null] as const) {
			const info = duplicateInfo(personal, kind);
			expect(info.kindChanges).toBe(false);
			expect(archiveOriginalDefault(info.kindChanges)).toBe(false);
		}
	});
});

describe('parseKind and duplicateHref', () => {
	it('accepts only the two kinds', () => {
		expect(parseKind('rotation')).toBe('rotation');
		expect(parseKind('personal')).toBe('personal');
		expect(parseKind('other')).toBeNull();
		expect(parseKind(null)).toBeNull();
	});

	it('builds the creator URL', () => {
		expect(duplicateHref('abc')).toBe('/chores/new?from=abc');
		expect(duplicateHref('abc', 'rotation')).toBe(
			'/chores/new?from=abc&kind=rotation',
		);
	});
});
