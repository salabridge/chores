import { describe, expect, it } from 'vitest';
import {
	buildNotes,
	buildWorkload,
	type ChoreStatusRow,
	dueText,
	familyStreakDays,
	formatTime,
	handoffText,
	joinNames,
	openCount,
	percentOf,
	rotationChain,
	rowActions,
	sortRows,
	workloadBalance,
	workloadSummary,
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

describe('workloadBalance', () => {
	it('is balanced when there is little to balance', () => {
		expect(workloadBalance([])).toBe('balanced');
		expect(workloadBalance([5])).toBe('balanced');
		expect(workloadBalance([2, 0])).toBe('balanced');
	});

	it('ignores small gaps', () => {
		expect(workloadBalance([2, 0, 1, 0])).toBe('balanced');
		expect(workloadBalance([3, 1, 2])).toBe('balanced');
	});

	it('does not flag one idle member in an even split', () => {
		expect(workloadBalance([3, 3, 3, 0])).toBe('balanced');
	});

	it('flags a big, lopsided gap', () => {
		expect(workloadBalance([5, 0])).toBe('unbalanced');
		expect(workloadBalance([4, 1, 1, 1])).toBe('unbalanced');
	});
});

describe('workloadSummary', () => {
	it('words each combination', () => {
		expect(workloadSummary([], [])).toBe('Nothing assigned today.');
		expect(workloadSummary(['A'], [])).toBe('A in progress.');
		expect(workloadSummary([], ['A', 'B'])).toBe('A and B completed.');
		expect(workloadSummary(['A'], ['B'])).toBe('A in progress; B completed.');
		expect(workloadSummary(['A', 'B', 'C', 'D'], [])).toBe(
			'A, B and 2 more in progress.',
		);
	});
});

describe('buildWorkload', () => {
	const members = [
		{ id: 'a', name: 'Ann' },
		{ id: 'b', name: 'Ben' },
		{ id: 'c', name: 'Cy' },
	];

	it('counts active and done, sorts busiest first and scales the bars', () => {
		const w = buildWorkload(members, [
			{ memberId: 'b', title: 'X', done: false },
			{ memberId: 'b', title: 'Y', done: true },
			{ memberId: 'a', title: 'Z', done: false },
		]);
		expect(w.members.map((m) => m.name)).toEqual(['Ben', 'Ann', 'Cy']);
		expect(w.members[0]).toMatchObject({ active: 1, done: 1, barPercent: 100 });
		expect(w.members[1]).toMatchObject({ active: 1, done: 0, barPercent: 50 });
		expect(w.members[2]).toMatchObject({ active: 0, done: 0, barPercent: 0 });
		expect(w.balance).toBe('balanced');
	});

	it('handles no chores at all', () => {
		const w = buildWorkload(members, []);
		expect(w.members.every((m) => m.barPercent === 0)).toBe(true);
	});
});

describe('rotationChain', () => {
	const m = (memberId: string, position: number, eligible = true) => ({
		memberId,
		name: memberId.toUpperCase(),
		position,
		eligible,
	});
	const members = [m('c', 2), m('a', 0), m('x', 1, false), m('b', 3)];

	it('starts at the current turn and wraps once around the loop', () => {
		expect(rotationChain(members, 'a')).toEqual({
			order: ['A', 'C', 'B'],
			resetAt: 3,
		});
		expect(rotationChain(members, 'c')).toEqual({
			order: ['C', 'B', 'A'],
			resetAt: 2,
		});
	});

	it('shows a full loop when the current member is last', () => {
		expect(rotationChain(members, 'b')).toEqual({
			order: ['B', 'A', 'C'],
			resetAt: 1,
		});
	});

	it('hands the turn to the first eligible member when the current one is excluded', () => {
		expect(rotationChain(members, 'x')).toEqual({
			order: ['A', 'C', 'B'],
			resetAt: 3,
		});
	});

	it('is empty when nobody is eligible or there is no current turn', () => {
		expect(rotationChain([m('a', 0, false)], 'a')).toEqual({
			order: [],
			resetAt: 0,
		});
	});
});

describe('handoffText', () => {
	const base = {
		dueToday: true,
		doneToday: false,
		dueTime: null,
		dueLabel: null,
		frequency: 'daily' as const,
	};

	it('prefers a time, then a label, then the frequency', () => {
		expect(handoffText({ ...base, dueTime: '20:00:00' })).toBe(
			'Next handoff at 8:00 PM',
		);
		expect(handoffText({ ...base, dueLabel: 'after dinner' })).toBe(
			'Next handoff after dinner',
		);
		expect(handoffText(base)).toBe('Next handoff today');
		expect(handoffText({ ...base, frequency: 'weekly' })).toBe(
			'Next handoff this week',
		);
	});

	it('points at the next period once today is done', () => {
		const done = { ...base, dueToday: false, doneToday: true };
		expect(handoffText(done)).toBe('Next handoff tomorrow');
		expect(handoffText({ ...done, frequency: 'weekends' })).toBe(
			'Next handoff next weekend',
		);
	});

	it('says this weekend for a weekends chore that does not occur today', () => {
		expect(
			handoffText({ ...base, dueToday: false, frequency: 'weekends' }),
		).toBe('Next handoff this weekend');
	});
});

describe('buildNotes', () => {
	const loop = (over: Partial<ChoreStatusRow>) =>
		row({ isLoop: true, ...over });

	it('generates warning, info and success notes in that order', () => {
		const notes = buildNotes({
			exclusions: ['Mia is excluded from Dishes.'],
			rows: [
				loop({
					choreId: 'a',
					title: 'Small',
					points: 5,
					status: 'active-turn',
				}),
				loop({ choreId: 'b', title: 'Big', points: 20, status: 'active-turn' }),
				loop({ choreId: 'c', title: 'Dog', status: 'completed' }),
				row({ choreId: 'd', title: 'Personal', points: 99 }),
			],
			currentTurn: new Map([['c', 'Leo']]),
		});
		expect(notes.map((n) => n.tone)).toEqual(['warning', 'info', 'success']);
		expect(notes[1]?.text).toBe(
			'Big is the highest-value active rotation today (20 pts).',
		);
		expect(notes[2]?.text).toBe('Dog is done, so Leo is up next.');
	});

	it('is empty when nothing applies, and caps unblocked notes at two', () => {
		expect(
			buildNotes({ exclusions: [], rows: [], currentTurn: new Map() }),
		).toEqual([]);
		const done = ['a', 'b', 'c'].map((id) =>
			loop({ choreId: id, title: id, status: 'completed' }),
		);
		expect(
			buildNotes({ exclusions: [], rows: done, currentTurn: new Map() }),
		).toHaveLength(2);
	});
});
