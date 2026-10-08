import { describe, expect, it } from 'vitest';
import {
	type ChoreStatusRow,
	dueText,
	familyStreakDays,
	formatTime,
	joinNames,
	openCount,
	percentOf,
	rowActions,
	sortRows,
} from './overview.ts';

const row = (over: Partial<ChoreStatusRow> = {}): ChoreStatusRow => ({
	choreId: 'c1',
	instanceId: null,
	completionId: null,
	title: 'Chore',
	context: '',
	assignee: null,
	status: 'todo',
	points: 10,
	isLoop: false,
	...over,
});

describe('sortRows / openCount', () => {
	it('puts open rows before completed ones, keeping order', () => {
		const rows = [
			row({ choreId: 'a', status: 'completed' }),
			row({ choreId: 'b', status: 'staged' }),
			row({ choreId: 'c', status: 'active-turn' }),
		];
		expect(sortRows(rows).map((r) => r.choreId)).toEqual(['b', 'c', 'a']);
		expect(openCount(rows)).toBe(2);
	});
});

describe('rowActions', () => {
	it('offers Skip and Remind while open', () => {
		expect(rowActions(row({ status: 'active-turn', isLoop: true }))).toEqual({
			skip: true,
			remind: true,
			reopen: false,
			viewLoop: false,
		});
	});

	it('offers Reopen, and View Loop only for loops, once completed', () => {
		expect(rowActions(row({ status: 'completed', isLoop: true }))).toEqual({
			skip: false,
			remind: false,
			reopen: true,
			viewLoop: true,
		});
		expect(rowActions(row({ status: 'completed' })).viewLoop).toBe(false);
	});
});

describe('percentOf / joinNames', () => {
	it('rounds and guards against zero', () => {
		expect(percentOf(8, 12)).toBe(67);
		expect(percentOf(0, 0)).toBe(0);
	});

	it('joins names', () => {
		expect(joinNames([])).toBe('');
		expect(joinNames(['A'])).toBe('A');
		expect(joinNames(['A', 'B'])).toBe('A and B');
		expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
	});
});

describe('familyStreakDays', () => {
	it('counts consecutive days ending today', () => {
		expect(
			familyStreakDays(
				['2026-10-06', '2026-10-07', '2026-10-08'],
				'2026-10-08',
			),
		).toBe(3);
	});

	it('keeps the streak alive while today is still empty', () => {
		expect(familyStreakDays(['2026-10-06', '2026-10-07'], '2026-10-08')).toBe(
			2,
		);
	});

	it('stops at a gap and is 0 once a day was missed', () => {
		expect(familyStreakDays(['2026-10-05', '2026-10-08'], '2026-10-08')).toBe(
			1,
		);
		expect(familyStreakDays(['2026-10-05'], '2026-10-08')).toBe(0);
	});

	it('crosses month boundaries', () => {
		expect(familyStreakDays(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(
			2,
		);
	});
});

describe('dueText / formatTime', () => {
	const base = {
		status: 'todo' as const,
		stageProgress: null,
		dueLabel: null,
		dueTime: null,
		frequency: 'daily' as const,
	};

	it('prefers stage progress, then label, then time, then frequency', () => {
		expect(
			dueText({ ...base, stageProgress: { done: 0, total: 3 }, dueLabel: 'x' }),
		).toBe('stage 1 of 3');
		expect(dueText({ ...base, dueLabel: 'after dinner' })).toBe('after dinner');
		expect(dueText({ ...base, dueTime: '20:00:00' })).toBe('by 8:00 PM');
		expect(dueText(base)).toBe('due today');
		expect(dueText({ ...base, frequency: 'weekly' })).toBe('due this week');
		expect(dueText({ ...base, status: 'completed' })).toBe('done');
	});

	it('formats clock times', () => {
		expect(formatTime('00:05:00')).toBe('12:05 AM');
		expect(formatTime('12:00:00')).toBe('12:00 PM');
		expect(formatTime('08:30:00')).toBe('8:30 AM');
	});
});
