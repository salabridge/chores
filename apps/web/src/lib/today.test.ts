import { describe, expect, it } from 'vitest';
import {
	buildToday,
	dueDayFor,
	type PersonalFacts,
	pickPriority,
	type RotationFacts,
	rotationItem,
	streakNote,
	streakTitle,
} from './today.ts';

const personal = (over: Partial<PersonalFacts> = {}): PersonalFacts => ({
	choreId: 'p',
	title: 'Chore',
	points: 10,
	frequency: 'daily',
	dueTime: null,
	dueLabel: null,
	due: null,
	stages: { done: 0, total: 0 },
	completed: false,
	...over,
});

const rotation = (over: Partial<RotationFacts> = {}): RotationFacts => ({
	choreId: 'r',
	title: 'Loop',
	points: 10,
	turnMemberId: 'leo',
	turnMemberName: 'Leo',
	stages: { done: 0, total: 0 },
	completed: false,
	completedByName: null,
	due: null,
	...over,
});

const build = (input: {
	personal?: PersonalFacts[];
	rotations?: RotationFacts[];
}) =>
	buildToday({
		member: { id: 'leo', name: 'Leo' },
		points: 40,
		streak: { days: 2, exceptions: 0 },
		week: {
			label: 'Oct 5–11',
			number: 41,
			days: [],
			done: 3,
			due: 4,
			points: 25,
		},
		personal: input.personal ?? [],
		rotations: input.rotations ?? [],
	});

describe('sort order', () => {
	it('puts in progress before todo before completed', () => {
		const data = build({
			personal: [
				personal({ choreId: 'done', title: 'A', completed: true }),
				personal({ choreId: 'todo', title: 'B' }),
				personal({
					choreId: 'wip',
					title: 'C',
					points: 1,
					stages: { done: 1, total: 3 },
				}),
			],
		});
		expect(data.personal.map((i) => [i.choreId, i.status])).toEqual([
			['wip', 'in-progress'],
			['todo', 'todo'],
			['done', 'completed'],
		]);
	});

	it('orders rotations the same way, my turn first within a group', () => {
		const data = build({
			rotations: [
				rotation({ choreId: 'done', completed: true, completedByName: 'Mia' }),
				rotation({
					choreId: 'theirs',
					points: 50,
					turnMemberId: 'mia',
					turnMemberName: 'Mia',
				}),
				rotation({ choreId: 'mine', points: 5 }),
				rotation({
					choreId: 'mine-wip',
					points: 1,
					stages: { done: 2, total: 3 },
				}),
			],
		});
		expect(data.rotations.map((i) => i.choreId)).toEqual([
			'mine-wip',
			'mine',
			'theirs',
			'done',
		]);
	});

	it('breaks ties by points, then title', () => {
		const data = build({
			personal: [
				personal({ choreId: 'b', title: 'B', points: 5 }),
				personal({ choreId: 'a', title: 'A', points: 5 }),
				personal({ choreId: 'big', title: 'Z', points: 20 }),
			],
		});
		expect(data.personal.map((i) => i.choreId)).toEqual(['big', 'a', 'b']);
	});
});

describe('priority pick', () => {
	it('is the highest-value open rotation that is my turn', () => {
		const data = build({
			rotations: [
				rotation({ choreId: 'small', title: 'Small', points: 10 }),
				rotation({ choreId: 'big', title: 'Big', points: 30 }),
				rotation({
					choreId: 'theirs',
					title: 'Theirs',
					points: 99,
					turnMemberId: 'mia',
				}),
				rotation({
					choreId: 'done',
					title: 'Done',
					points: 80,
					completed: true,
					completedByName: 'Leo',
				}),
			],
		});
		expect(data.priority).toEqual({ choreId: 'big', title: 'Big', points: 30 });
	});

	it('breaks ties by title', () => {
		const data = build({
			rotations: [
				rotation({ choreId: 'b', title: 'Bins', points: 10 }),
				rotation({ choreId: 'a', title: 'Alpha', points: 10 }),
			],
		});
		expect(data.priority?.choreId).toBe('a');
	});

	it('is null when no open rotation is my turn', () => {
		expect(pickPriority([])).toBeNull();
		const data = build({
			rotations: [rotation({ turnMemberId: 'mia', turnMemberName: 'Mia' })],
		});
		expect(data.priority).toBeNull();
	});
});

describe('rotation wording', () => {
	it('says "Completed by X" for a finished rotation, with no points', () => {
		const item = rotationItem(
			rotation({ completed: true, completedByName: 'Mia' }),
			'leo',
		);
		expect(item.subtitle).toBe('Shared rotation • Completed by Mia');
		expect(item.points).toBeNull();
		expect(item.status).toBe('completed');
		expect(item.variant).toBe('completed');
	});

	it('says whose turn it is when it is not mine', () => {
		const item = rotationItem(
			rotation({ turnMemberId: 'mia', turnMemberName: 'Mia' }),
			'leo',
		);
		expect(item.subtitle).toBe('Shared rotation • Mia has the turn');
		expect(item.status).toBeNull();
		expect(item.variant).toBe('shared');
		expect(item.myTurn).toBe(false);
	});

	it('highlights my turn', () => {
		const item = rotationItem(rotation(), 'leo');
		expect(item.status).toBe('my-turn');
		expect(item.variant).toBe('highlighted');
		expect(item.myTurn).toBe(true);
		expect(item.href).toBe('/chores/r');
	});
});

describe('personal wording', () => {
	it('shows the stage, then the due time, label, or period', () => {
		const sub = (over: Partial<PersonalFacts>) =>
			build({ personal: [personal(over)] }).personal[0]?.subtitle;
		expect(sub({ stages: { done: 1, total: 3 } })).toBe(
			'Stage 2 of 3 • Continue where you left off',
		);
		expect(sub({ dueTime: '20:00:00' })).toBe('Due by 8:00 PM');
		expect(sub({ dueLabel: 'after dinner' })).toBe('Due after dinner');
		expect(sub({ frequency: 'weekly' })).toBe('Due this week');
		expect(sub({})).toBe('Due today');
	});
});

describe('summary', () => {
	it('counts open personal chores and the points on my turns', () => {
		const data = build({
			personal: [
				personal({ choreId: 'a', points: 10 }),
				personal({ choreId: 'b', points: 15 }),
				personal({ choreId: 'c', points: 99, completed: true }),
			],
			rotations: [
				rotation({ choreId: 'mine', points: 20 }),
				rotation({ choreId: 'theirs', points: 7, turnMemberId: 'mia' }),
				rotation({ choreId: 'done', points: 5, completed: true }),
			],
		});
		expect(data.summary).toEqual({
			personalCount: 2,
			personalPoints: 25,
			loopCount: 3,
			availablePoints: 20,
		});
	});
});

describe('streak copy', () => {
	it('titles the streak', () => {
		expect(streakTitle({ days: 5, exceptions: 0 })).toBe(
			'5-Day Active Streak!',
		);
		expect(streakTitle({ days: 0, exceptions: 0 })).toBe(
			'Start a streak today!',
		);
	});

	it('adds a note about what is left and any exceptions', () => {
		expect(streakNote({ days: 3, exceptions: 0 }, 2)).toBe(
			'2 chores left today to keep it going.',
		);
		expect(streakNote({ days: 3, exceptions: 1 }, 0)).toBe(
			"You're all caught up today! Includes 1 exception.",
		);
		expect(streakNote({ days: 0, exceptions: 0 }, 0)).toBeNull();
	});
});

describe('weekly chores with a due day (SB-71)', () => {
	const thu = (state: 'upcoming' | 'today' | 'overdue') => ({
		weekday: 4 as const,
		state,
	});

	it('works out the due state in the week of periodStart', () => {
		const chore = { frequency: 'weekly' as const, dueWeekday: 4 };
		// The week of Monday 2026-10-12; Thursday is the 15th.
		expect(dueDayFor(chore, '2026-10-12', '2026-10-13')).toEqual(
			thu('upcoming'),
		);
		expect(dueDayFor(chore, '2026-10-12', '2026-10-15')).toEqual(thu('today'));
		expect(dueDayFor(chore, '2026-10-12', '2026-10-17')).toEqual(
			thu('overdue'),
		);
		expect(
			dueDayFor({ ...chore, dueWeekday: null }, '2026-10-12', '2026-10-13'),
		).toBeNull();
		expect(
			dueDayFor(
				{ frequency: 'daily', dueWeekday: 4 },
				'2026-10-13',
				'2026-10-13',
			),
		).toBeNull();
	});

	it('says when it is due, with the time or label', () => {
		const data = build({
			personal: [
				personal({
					choreId: 'today',
					frequency: 'weekly',
					dueTime: '19:00:00',
					due: thu('today'),
				}),
				personal({
					choreId: 'late',
					frequency: 'weekly',
					dueLabel: 'after dinner',
					due: thu('overdue'),
				}),
			],
		});
		const byId = Object.fromEntries(data.personal.map((i) => [i.choreId, i]));
		expect(byId.today).toMatchObject({
			subtitle: 'Due today by 7:00 PM',
			status: 'todo',
		});
		expect(byId.late).toMatchObject({
			subtitle: 'Was due Thu · after dinner',
			status: 'overdue',
		});
		// Overdue sorts first, and still counts as to do today.
		expect(data.personal[0].choreId).toBe('late');
		expect(data.summary.personalCount).toBe(2);
	});

	it('keeps stage progress on an overdue chore and names the day', () => {
		const data = build({
			personal: [
				personal({
					frequency: 'weekly',
					due: thu('overdue'),
					stages: { done: 1, total: 3 },
				}),
			],
		});
		expect(data.personal[0]).toMatchObject({
			subtitle: 'Stage 2 of 3 • Was due Thu',
			status: 'in-progress',
		});
	});

	it('moves upcoming chores to Later this week, out of the summary', () => {
		const data = build({
			personal: [
				personal({ choreId: 'now', points: 5 }),
				personal({
					choreId: 'sat',
					title: 'Wash the car',
					frequency: 'weekly',
					points: 20,
					due: { weekday: 6, state: 'upcoming' },
				}),
			],
			rotations: [
				rotation({
					choreId: 'fri',
					title: 'Mow',
					due: { weekday: 5, state: 'upcoming' },
				}),
			],
		});
		expect(data.personal.map((i) => i.choreId)).toEqual(['now']);
		expect(data.rotations).toEqual([]);
		expect(data.later.map((i) => [i.choreId, i.subtitle])).toEqual([
			['fri', 'Household rotation • Due Fri'],
			['sat', 'Due Sat'],
		]);
		expect(data.summary).toMatchObject({
			personalCount: 1,
			personalPoints: 5,
			loopCount: 0,
			availablePoints: 0,
		});
		expect(data.priority).toBeNull();
	});

	it("keeps a chore done early in today's list as completed", () => {
		const data = build({
			personal: [
				personal({
					frequency: 'weekly',
					due: thu('upcoming'),
					completed: true,
				}),
			],
		});
		expect(data.later).toEqual([]);
		expect(data.personal[0].status).toBe('completed');
	});

	it("marks an overdue rotation turn and shows the day on someone else's turn", () => {
		const mine = rotationItem(rotation({ due: thu('overdue') }), 'leo');
		expect(mine).toMatchObject({
			subtitle: 'Household rotation • Was due Thu',
			status: 'overdue',
			myTurn: true,
		});
		const theirs = rotationItem(
			rotation({
				turnMemberId: 'mia',
				turnMemberName: 'Mia',
				due: thu('today'),
			}),
			'leo',
		);
		expect(theirs.subtitle).toBe(
			'Shared rotation • Mia has the turn • Due today',
		);
	});
});
