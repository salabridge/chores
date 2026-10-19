// Favour approval (SB-79): when Mia does Leo's chore, it waits for Leo (or a
// parent) to say it's done before Mia gets the points. Plain data shared by
// the server loads, the components and the tests. No server imports here:
// this file is bundled into the client.

import { possessive } from './favour.ts';

/**
 * Where a completion stands (`chore_completions.approval_status`). Only
 * favours by someone who isn't a parent are ever `pending` or `declined`.
 */
export type FavourStatus = 'approved' | 'pending' | 'declined';

export interface FavourMember {
	memberId: string;
	name: string;
}

/**
 * A favour waiting for a decision on this period's chore, as the detail
 * screens show it. While it's pending, the chore can't be completed again:
 * the assignee approves or declines it instead.
 */
export interface PendingFavour {
	completionId: string;
	/** Who says they did it. Null if they've since left the household. */
	doneBy: FavourMember | null;
	/** The doer asked a parent: only a parent can decide it now. */
	escalated: boolean;
}

/** One favour in a list (Today, the parent Overview). */
export interface FavourItem {
	completionId: string;
	choreId: string;
	title: string;
	/** The points the doer gets if it's approved (or got, once approved). */
	points: number;
	status: FavourStatus;
	/** Whose chore it was: the assignee or rotation turn-holder. */
	assignee: FavourMember | null;
	/** Who did it. */
	doneBy: FavourMember | null;
	/** When it was done (ISO). */
	completedAt: string;
	/** When the doer asked a parent (ISO), or null. */
	escalatedAt: string | null;
	/** Who made the current decision, and when (ISO); null while undecided. */
	decidedBy: FavourMember | null;
	decidedAt: string | null;
	/**
	 * The assignee made the current decision (not a parent). Only an
	 * assignee's decline can still go to a parent.
	 */
	decidedByAssignee: boolean;
	/**
	 * The doer may ask a parent now: it's pending and they haven't asked yet,
	 * or the assignee declined it and the chore hasn't been done again since.
	 */
	canAskParent: boolean;
}

/** The favour lists on a member's Today screen. */
export interface MemberFavours {
	/**
	 * Favours on the member's own chores waiting for their OK ("Mia says she
	 * did Take out trash"). Escalated ones are left out: a parent decides
	 * those.
	 */
	toApprove: FavourItem[];
	/**
	 * Favours the member did for others in the last week: pending ones first
	 * (waiting for the assignee, or for a parent), then decided ones, newest
	 * first, so they see "Leo approved" or "Leo said not done".
	 */
	mine: FavourItem[];
}

/** Done screen, while the favour waits for approval. */
export const pendingFavourText = (points: number, ownerName: string) =>
	`Sent to ${ownerName} for approval. You'll get +${points} ${points === 1 ? 'point' : 'points'} when ${ownerName} (or a parent) says it's done.`;

/** Done screen line under the heading, for a pending favour. */
export const pendingSummaryLine = (title: string, ownerName: string) =>
	`${title} is waiting for ${possessive(ownerName)} OK.`;

/** Done screen label over the points, for a pending favour. */
export const POINTS_PENDING_LABEL = 'Points Pending';
