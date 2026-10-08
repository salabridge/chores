import type { ChoreStatusRow, OverviewStats } from '#lib/overview.js';

// Fixed data for specs and stories (stories are Chromatic snapshots, so no
// dates or randomness).

export const overviewRows: ChoreStatusRow[] = [
	{
		choreId: 'toilet',
		instanceId: 'i-toilet',
		completionId: null,
		title: 'Shared Bathroom Toilet',
		context: 'Household rotation • due today',
		assignee: { memberId: 'leo', name: 'Leo' },
		status: 'active-turn',
		points: 20,
		isLoop: true,
	},
	{
		choreId: 'dishwasher',
		instanceId: null,
		completionId: null,
		title: 'Run Dishwasher',
		context: 'Kitchen Helpers • after dinner',
		assignee: { memberId: 'mom', name: 'Mom' },
		status: 'active-turn',
		points: 15,
		isLoop: true,
	},
	{
		choreId: 'room',
		instanceId: 'i-room',
		completionId: null,
		title: 'Clean Your Room',
		context: "Mia's personal chore • stage 2 of 3",
		assignee: { memberId: 'mia', name: 'Mia' },
		status: 'staged',
		points: 15,
		isLoop: false,
	},
	{
		choreId: 'dog',
		instanceId: 'i-dog',
		completionId: 'done-dog',
		title: 'Feed Dog',
		context: 'Kids rotation • done',
		assignee: { memberId: 'mia', name: 'Mia' },
		status: 'completed',
		points: 10,
		isLoop: true,
	},
	{
		choreId: 'bed',
		instanceId: 'i-bed',
		completionId: 'done-bed',
		title: 'Make Bed',
		context: "Leo's personal chore • done",
		assignee: { memberId: 'leo', name: 'Leo' },
		status: 'completed',
		points: 5,
		isLoop: false,
	},
];

export const overviewStats: OverviewStats = {
	totalChores: 12,
	sharedLoops: 7,
	personalChores: 5,
	activeRotations: 4,
	rotationsDueSoon: 2,
	dueSoonTitles: ['Shared Bathroom Toilet', 'Run Dishwasher'],
	completedToday: 8,
	dueToday: 12,
	completedPercent: 67,
	streakDays: 5,
	exceptions: 1,
	firstException: 'Mia is excluded from Run Dishwasher: too young.',
};
