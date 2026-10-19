import type { StreakWeek } from '#lib/streak.js';
import {
	buildToday,
	type HelpOutFacts,
	helpOutItem,
	sortHelpOut,
	type TodayData,
} from '#lib/today.js';

// Fixed data for specs and stories (stories are Chromatic snapshots, so no
// dates or randomness). Mirrors the Figma frame: Leo with two personal chores
// and rotations.

const leo = { id: 'leo', name: 'Leo' };

// Other members' open chores (SB-75): Mia's personal chore and Dad's turn.
export const helpOutFacts: HelpOutFacts[] = [
	{
		kind: 'personal',
		choreId: 'mia-trash',
		title: 'Take Out the Trash',
		points: 10,
		ownerId: 'mia',
		ownerName: 'Mia',
		frequency: 'daily',
		dueTime: '20:00:00',
		dueLabel: null,
		due: null,
		stages: { done: 0, total: 0 },
	},
	{
		kind: 'rotation',
		choreId: 'dad-gutters',
		title: 'Clear the Gutters',
		points: 25,
		ownerId: 'dad',
		ownerName: 'Dad',
		frequency: 'weekly',
		dueTime: null,
		dueLabel: null,
		due: { weekday: 1, state: 'overdue' },
		stages: { done: 0, total: 0 },
	},
];

// The Figma frame's week: Oct 5–11, 6 of 10 done, 85 pts. Only the totals
// show on Today, so the days are left as the Streak tab would build them.
const week = (done: number, due: number, points: number): StreakWeek => ({
	label: 'Oct 5–11',
	number: 41,
	days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => ({
		date: `2026-10-${String(5 + i).padStart(2, '0')}`,
		letter,
		dayOfMonth: 5 + i,
		active: false,
	})),
	done,
	due,
	points,
});

export const todayData: TodayData = buildToday({
	member: leo,
	points: 140,
	streak: { days: 5, exceptions: 0 },
	week: week(6, 10, 85),
	personal: [
		{
			choreId: 'recycling',
			title: 'Take Out Recycling',
			points: 10,
			frequency: 'daily',
			dueTime: '20:00:00',
			dueLabel: null,
			due: null,
			stages: { done: 0, total: 0 },
			completed: false,
			doneByName: null,
		},
		{
			choreId: 'room',
			title: 'Clean Your Room',
			points: 15,
			frequency: 'daily',
			dueTime: null,
			dueLabel: null,
			due: null,
			stages: { done: 1, total: 3 },
			completed: false,
			doneByName: null,
		},
	],
	rotations: [
		{
			choreId: 'dog',
			title: 'Feed the Dog',
			points: 5,
			turnMemberId: 'dad',
			turnMemberName: 'Dad',
			stages: { done: 0, total: 0 },
			completed: true,
			completedByName: 'Mia',
			due: null,
		},
		{
			choreId: 'toilet',
			title: 'Clean Bathroom Toilet',
			points: 20,
			turnMemberId: 'leo',
			turnMemberName: 'Leo',
			stages: { done: 0, total: 0 },
			completed: false,
			completedByName: null,
			due: null,
		},
		{
			choreId: 'dishes',
			title: 'Run Dishwasher',
			points: 10,
			turnMemberId: 'mia',
			turnMemberName: 'Mia',
			stages: { done: 0, total: 0 },
			completed: false,
			completedByName: null,
			due: null,
		},
	],
});

// SB-75: the same day with Mia's and Dad's open chores under "Help out".
export const helpOutToday: TodayData = {
	...todayData,
	helpOut: sortHelpOut(helpOutFacts.map(helpOutItem)),
};

export const emptyToday: TodayData = buildToday({
	member: leo,
	points: 0,
	streak: { days: 0, exceptions: 0 },
	week: week(0, 0, 0),
	personal: [],
	rotations: [],
});

// SB-71: weekly chores with a due day, seen on a Thursday. One due today, one
// overdue (due Monday), and two later this week: a personal chore and a
// rotation that is Leo's turn.
export const weeklyDueToday: TodayData = buildToday({
	member: leo,
	points: 140,
	streak: { days: 5, exceptions: 0 },
	week: week(6, 10, 85),
	personal: [
		{
			choreId: 'bins',
			title: 'Take the Bins Out',
			points: 10,
			frequency: 'weekly',
			dueTime: '19:00:00',
			dueLabel: null,
			due: { weekday: 4, state: 'today' },
			stages: { done: 0, total: 0 },
			completed: false,
			doneByName: null,
		},
		{
			choreId: 'plants',
			title: 'Water the Plants',
			points: 5,
			frequency: 'weekly',
			dueTime: null,
			dueLabel: null,
			due: { weekday: 1, state: 'overdue' },
			stages: { done: 0, total: 0 },
			completed: false,
			doneByName: null,
		},
		{
			choreId: 'car',
			title: 'Wash the Car',
			points: 20,
			frequency: 'weekly',
			dueTime: null,
			dueLabel: 'before lunch',
			due: { weekday: 6, state: 'upcoming' },
			stages: { done: 0, total: 0 },
			completed: false,
			doneByName: null,
		},
	],
	rotations: [
		{
			choreId: 'lawn',
			title: 'Mow the Lawn',
			points: 15,
			turnMemberId: 'leo',
			turnMemberName: 'Leo',
			stages: { done: 0, total: 0 },
			completed: false,
			completedByName: null,
			due: { weekday: 7, state: 'upcoming' },
		},
		{
			choreId: 'dishes',
			title: 'Run Dishwasher',
			points: 10,
			turnMemberId: 'mia',
			turnMemberName: 'Mia',
			stages: { done: 0, total: 0 },
			completed: false,
			completedByName: null,
			due: null,
		},
	],
});
