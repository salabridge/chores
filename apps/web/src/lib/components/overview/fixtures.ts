import type {
	ChoreStatusRow,
	OverviewNote,
	OverviewStats,
	UpcomingRotation,
	WorkloadOverview,
} from '#lib/overview.js';

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

export const workloadFixture: WorkloadOverview = {
	balance: 'balanced',
	members: [
		{
			memberId: 'leo',
			name: 'Leo',
			active: 2,
			done: 0,
			summary: 'Shared Bathroom Toilet and Clean Your Room in progress.',
			barPercent: 100,
		},
		{
			memberId: 'mia',
			name: 'Mia',
			active: 0,
			done: 1,
			summary: 'Feed Dog completed.',
			barPercent: 50,
		},
		{
			memberId: 'mom',
			name: 'Mom',
			active: 1,
			done: 0,
			summary: 'Run Dishwasher in progress.',
			barPercent: 50,
		},
		{
			memberId: 'dad',
			name: 'Dad',
			active: 0,
			done: 0,
			summary: 'Nothing assigned today.',
			barPercent: 0,
		},
	],
};

export const upcomingRotations: UpcomingRotation[] = [
	{
		choreId: 'toilet',
		title: 'Shared Bathroom Toilet',
		handoff: 'Next handoff at 8:00 PM',
		dueToday: true,
		order: ['Leo', 'Mia'],
	},
	{
		choreId: 'dishwasher',
		title: 'Run Dishwasher',
		handoff: 'Next handoff after dinner',
		dueToday: true,
		order: ['Mom', 'Dad', 'Leo'],
	},
	{
		choreId: 'dog',
		title: 'Feed Dog',
		handoff: 'Next handoff tomorrow',
		dueToday: false,
		order: ['Leo', 'Mia'],
	},
];

export const overviewNotes: OverviewNote[] = [
	{
		tone: 'warning',
		kind: 'exclusion',
		text: 'Mia is excluded from Run Dishwasher: too young.',
	},
	{
		tone: 'info',
		kind: 'priority',
		text: 'Shared Bathroom Toilet is the highest-value active rotation today (20 pts).',
	},
	{
		tone: 'success',
		kind: 'unblocked',
		text: 'Feed Dog is done, so Leo is up next.',
	},
];
