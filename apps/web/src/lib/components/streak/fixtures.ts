import type { StreakScreenData, StreakWeek } from '#lib/streak.js';

// Matches the Figma mock (03 · Rewards & Streaks, mobile-streak).

const days = (active: boolean[]): StreakWeek['days'] =>
	['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => ({
		date: `2026-10-${String(5 + i).padStart(2, '0')}`,
		letter,
		dayOfMonth: 5 + i,
		active: active[i] ?? false,
	}));

export const streakWeek: StreakWeek = {
	label: 'Oct 5–11',
	number: 41,
	days: days([true, true, true, true, true, false, false]),
	done: 6,
	due: 10,
	points: 85,
};

export const streakData: StreakScreenData = {
	name: 'Leo',
	points: 140,
	streak: { days: 5, exceptions: 0 },
	goal: 7,
	note: 'Mia is catching up!',
	week: streakWeek,
	momentum: {
		days: 3,
		goal: 4,
		loopsLeft: 1,
		percent: 75,
		message:
			"You're close to a 4-day personal streak and one more easy loop is enough to get there.",
		chores: [{ id: 'c1', title: 'Take Out Recycling', href: '#' }],
	},
};

/** A new member: nothing done yet this week. */
export const noStreak: StreakScreenData = {
	name: 'Sam',
	points: 0,
	streak: { days: 0, exceptions: 0 },
	goal: 3,
	note: null,
	week: { ...streakWeek, days: days([]), done: 0, due: 4, points: 0 },
	momentum: {
		days: 0,
		goal: 3,
		loopsLeft: 3,
		percent: 0,
		message: 'Finish a loop today to start a streak.',
		chores: [],
	},
};
