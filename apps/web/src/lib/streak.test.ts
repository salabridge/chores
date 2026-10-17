import type { DueChore } from '@chore/db/streaks';
import { describe, expect, it } from 'vitest';
import {
	buildStreakScreen,
	isoWeek,
	nextUp,
	streakNote,
	streakWeek,
	weekLabel,
} from './streak.ts';

const done = (memberId: string, date: string): DueChore => ({
	memberId,
	date,
	outcome: 'done',
});
const missed = (memberId: string, date: string): DueChore => ({
	memberId,
	date,
	outcome: 'missed',
});

describe('weekLabel', () => {
	it('names the month once inside a month', () => {
		expect(weekLabel('2026-10-05')).toBe('Oct 5–11');
	});

	it('names both months across a month boundary', () => {
		expect(weekLabel('2026-09-28')).toBe('Sep 28–Oct 4');
	});
});

describe('isoWeek', () => {
	it('numbers weeks the ISO way', () => {
		expect(isoWeek('2026-10-05')).toBe(41);
		// 2027-01-01 is a Friday, so it still belongs to 2026's last week.
		expect(isoWeek('2027-01-01')).toBe(53);
		expect(isoWeek('2027-01-04')).toBe(1);
	});
});

describe('streakNote', () => {
	it('is null when nobody else has a streak', () => {
		expect(streakNote(5, [{ name: 'Mia', days: 0 }])).toBeNull();
		expect(streakNote(5, [])).toBeNull();
	});

	it('compares against the longest other streak', () => {
		const others = [
			{ name: 'Sam', days: 1 },
			{ name: 'Mia', days: 3 },
		];
		expect(streakNote(5, others)).toBe('Mia is catching up!');
		expect(streakNote(3, others)).toBe('Mia is right there with you!');
		expect(streakNote(0, others)).toBe('Mia is on a 3-day streak!');
	});
});

describe('nextUp', () => {
	it('names the next goal and how far off it is', () => {
		expect(nextUp({ days: 5 }, 7)).toEqual({
			label: 'Next up: 7 active days',
			remaining: '2 more days',
		});
		expect(nextUp({ days: 6 }, 7).remaining).toBe('1 more day');
	});
});

describe('streakWeek', () => {
	// Thursday of the week of Oct 5, 2026.
	const today = '2026-10-08';

	it('lights the days the member did everything due', () => {
		const week = streakWeek({
			memberId: 'leo',
			today,
			due: [
				done('leo', '2026-10-05'),
				done('leo', '2026-10-06'),
				missed('leo', '2026-10-06'),
				done('leo', '2026-10-07'),
				done('mia', '2026-10-08'),
				// Last week: not in this calendar.
				done('leo', '2026-10-04'),
			],
			points: 85,
		});
		expect(week.label).toBe('Oct 5–11');
		expect(week.number).toBe(41);
		expect(week.days.map((d) => d.letter).join('')).toBe('MTWTFSS');
		expect(week.days.map((d) => d.dayOfMonth)).toEqual([5, 6, 7, 8, 9, 10, 11]);
		expect(week.days.map((d) => d.active)).toEqual([
			true,
			false,
			true,
			false,
			false,
			false,
			false,
		]);
		expect(week).toMatchObject({ done: 3, due: 4, points: 85 });
	});

	it("doesn't count skipped chores", () => {
		const week = streakWeek({
			memberId: 'leo',
			today,
			due: [
				done('leo', '2026-10-05'),
				{ memberId: 'leo', date: '2026-10-05', outcome: 'skipped' },
			],
			points: 0,
		});
		expect(week).toMatchObject({ done: 1, due: 1 });
		expect(week.days[0]?.active).toBe(true);
	});
});

describe('buildStreakScreen', () => {
	it('puts the streak, the household note, the week and momentum together', () => {
		const screen = buildStreakScreen({
			member: { id: 'leo', name: 'Leo' },
			members: [
				{ id: 'leo', name: 'Leo' },
				{ id: 'mia', name: 'Mia' },
			],
			streaks: {
				today: '2026-10-08',
				members: {
					leo: { days: 5, exceptions: 0 },
					mia: { days: 2, exceptions: 0 },
				},
				due: [done('leo', '2026-10-05')],
			},
			balance: 140,
			weekPoints: 85,
			suggested: [{ id: 'c1', title: 'Take Out Recycling' }],
		});
		expect(screen).toMatchObject({
			name: 'Leo',
			points: 140,
			streak: { days: 5, exceptions: 0 },
			goal: 7,
			note: 'Mia is catching up!',
			week: { number: 41, done: 1, due: 1, points: 85 },
			momentum: {
				days: 5,
				goal: 7,
				chores: [{ id: 'c1', title: 'Take Out Recycling', href: '/chores/c1' }],
			},
		});
	});

	it('treats a member with no streak entry as zero days', () => {
		const screen = buildStreakScreen({
			member: { id: 'leo', name: 'Leo' },
			members: [{ id: 'leo', name: 'Leo' }],
			streaks: { today: '2026-10-08', members: {}, due: [] },
			balance: 0,
			weekPoints: 0,
			suggested: [],
		});
		expect(screen.streak).toEqual({ days: 0, exceptions: 0 });
		expect(screen.goal).toBe(3);
		expect(screen.note).toBeNull();
	});
});
