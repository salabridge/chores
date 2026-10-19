import type {
	FavourItem,
	MemberFavours,
	PendingFavour,
} from '#lib/favour-approval.js';

// Fixed data for specs and stories (stories are Chromatic snapshots, so no
// dates or randomness). Mia did Leo's chores; Dad is a parent.

export const leo = { memberId: 'leo', name: 'Leo' };
export const mia = { memberId: 'mia', name: 'Mia' };
export const dad = { memberId: 'dad', name: 'Dad' };

/** The "now" the relative times in specs and stories are measured from. */
export const NOW = new Date('2026-10-14T18:00:00Z');

const base: FavourItem = {
	completionId: 'c1',
	choreId: 'trash',
	title: 'Take Out Trash',
	points: 10,
	status: 'pending',
	assignee: leo,
	doneBy: mia,
	completedAt: '2026-10-14T17:55:00Z',
	escalatedAt: null,
	decidedBy: null,
	decidedAt: null,
	decidedByAssignee: false,
	canAskParent: true,
};

/** Mia says she did Leo's chore; it waits for Leo. */
export const needsOk: FavourItem = base;

/** Mia's side of the same favour. */
export const waitingForOwner: FavourItem = base;

export const waitingForParent: FavourItem = {
	...base,
	completionId: 'c2',
	title: 'Feed the Dog',
	points: 5,
	completedAt: '2026-10-14T15:00:00Z',
	escalatedAt: '2026-10-14T16:00:00Z',
	canAskParent: false,
};

export const approvedByOwner: FavourItem = {
	...base,
	completionId: 'c3',
	title: 'Run Dishwasher',
	status: 'approved',
	decidedBy: leo,
	decidedAt: '2026-10-14T17:00:00Z',
	decidedByAssignee: true,
	canAskParent: false,
};

export const approvedByParent: FavourItem = {
	...approvedByOwner,
	completionId: 'c4',
	title: 'Clean Bathroom Toilet',
	points: 20,
	decidedBy: dad,
	decidedByAssignee: false,
};

export const declinedByOwner: FavourItem = {
	...base,
	completionId: 'c5',
	title: 'Water the Plants',
	points: 5,
	status: 'declined',
	decidedBy: leo,
	decidedAt: '2026-10-14T17:00:00Z',
	decidedByAssignee: true,
	canAskParent: true,
};

export const declinedByParent: FavourItem = {
	...declinedByOwner,
	completionId: 'c6',
	title: 'Vacuum the Stairs',
	decidedBy: dad,
	decidedByAssignee: false,
	canAskParent: false,
};

/** Leo's Today: one favour waiting for his OK. */
export const leoFavours: MemberFavours = { toApprove: [needsOk], mine: [] };

/** Mia's Today: waiting, escalated, and decided favours. */
export const miaFavours: MemberFavours = {
	toApprove: [],
	mine: [
		waitingForOwner,
		waitingForParent,
		declinedByOwner,
		approvedByOwner,
		approvedByParent,
		declinedByParent,
	],
};

/** The parent panel: the escalated favour first, then the pending ones. */
export const panelFavours: FavourItem[] = [
	waitingForParent,
	{
		...base,
		completionId: 'c7',
		title: 'Mow the Lawn',
		points: 15,
		completedAt: '2026-10-13T18:00:00Z',
	},
	needsOk,
];

export const pendingByMia: PendingFavour = {
	completionId: 'c1',
	doneBy: mia,
	escalated: false,
};
