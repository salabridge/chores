import { buildToday, type TodayData } from '#lib/today.js';

// Fixed data for specs and stories (stories are Chromatic snapshots, so no
// dates or randomness). Mirrors the Figma frame: Leo with two personal chores
// and rotations.

const leo = { id: 'leo', name: 'Leo' };

export const todayData: TodayData = buildToday({
	member: leo,
	points: 140,
	streak: { days: 5, exceptions: 0 },
	personal: [
		{
			choreId: 'recycling',
			title: 'Take Out Recycling',
			points: 10,
			frequency: 'daily',
			dueTime: '20:00:00',
			dueLabel: null,
			stages: { done: 0, total: 0 },
			completed: false,
		},
		{
			choreId: 'room',
			title: 'Clean Your Room',
			points: 15,
			frequency: 'daily',
			dueTime: null,
			dueLabel: null,
			stages: { done: 1, total: 3 },
			completed: false,
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
		},
	],
});

export const emptyToday: TodayData = buildToday({
	member: leo,
	points: 0,
	streak: { days: 0, exceptions: 0 },
	personal: [],
	rotations: [],
});
