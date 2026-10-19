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

// --- SB-80: the approval UI -------------------------------------------------

/**
 * What the approval UI can do. The route pages wire these to the remote
 * functions in `favours.remote.ts` and refresh their data afterwards; a
 * rejected promise's message is shown on the card.
 */
export interface FavourActions {
	approve: (completionId: string) => Promise<void>;
	decline: (completionId: string) => Promise<void>;
	askParent: (completionId: string) => Promise<void>;
}

const pts = (points: number) => `${points} ${points === 1 ? 'pt' : 'pts'}`;

/** "Mia says she did Take out trash." (the title is set in bold by the card). */
export const needsOkLead = (doerName: string | null) =>
	`${doerName ?? 'Someone'} says they did`;

/** "+10 pts go to Mia." */
export const needsOkPoints = (points: number, doerName: string | null) =>
	`+${pts(points)} go${doerName ? ` to ${doerName}` : ' to them'}.`;

export const APPROVE_LABEL = "Yes, it's done";
export const DECLINE_LABEL = 'Not done';
export const ASK_PARENT_LABEL = 'Ask a parent';
export const PARENT_APPROVE_LABEL = 'Approve';
export const PARENT_DECLINE_LABEL = 'Decline';

/** How a favour reads to the member who did it. */
export interface MyFavourState {
	kind: 'waiting' | 'waiting-parent' | 'approved' | 'declined';
	tone: 'info' | 'success' | 'warning';
	title: string;
	text: string;
}

/** "Leo" for the assignee, "Dad (a parent)" when a parent decided. */
const decider = (item: FavourItem) => {
	const name = item.decidedBy?.name;
	if (!name) return item.decidedByAssignee ? 'The owner' : 'A parent';
	return item.decidedByAssignee ? name : `${name} (a parent)`;
};

/** The state of one of the viewer's own favours on Today. */
export function myFavourState(item: FavourItem): MyFavourState {
	const owner = item.assignee?.name ?? 'the owner';
	if (item.status === 'approved') {
		return {
			kind: 'approved',
			tone: 'success',
			title: `+${pts(item.points)}, ${decider(item)} approved`,
			text: `${item.title} is done and the points are yours.`,
		};
	}
	if (item.status === 'declined') {
		return {
			kind: 'declined',
			tone: 'warning',
			title: `${decider(item)} said not done`,
			text: item.canAskParent
				? `No points for ${item.title}. If you did it, ask a parent to decide.`
				: `No points for ${item.title}. A parent made the call.`,
		};
	}
	if (item.escalatedAt) {
		return {
			kind: 'waiting-parent',
			tone: 'info',
			title: 'Waiting for a parent',
			text: `A parent will decide on ${item.title}. You'll get +${pts(item.points)} if they say it's done.`,
		};
	}
	return {
		kind: 'waiting',
		tone: 'info',
		title: `Waiting for ${owner}`,
		text: `You'll get +${pts(item.points)} when ${owner} (or a parent) says ${item.title} is done.`,
	};
}

/** "just now", "5 min ago", "3 hr ago", "2 days ago". */
export function whenText(iso: string, now: Date = new Date()): string {
	const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
	if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.floor(hours / 24);
	return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Parent panel, first line: "Mia did Take out trash". */
export const panelLine = (item: FavourItem) =>
	`${item.doneBy?.name ?? 'Someone'} did ${item.title}`;

/** Parent panel, second line: "Leo's chore · 10 pts · 5 min ago". */
export const panelDetail = (item: FavourItem, now?: Date) =>
	[
		item.assignee ? `${possessive(item.assignee.name)} chore` : 'Chore',
		pts(item.points),
		whenText(item.completedAt, now),
	].join(' · ');

export const PANEL_ESCALATED_LABEL = 'Asked a parent';

/** The heading badge on the portal nav ("9+" past nine). */
export const navBadgeText = (count: number) =>
	count > 9 ? '9+' : String(count);

/**
 * What the viewer sees on a chore with a pending favour: they did it, they
 * can decide it (the owner before it's escalated, a parent any time), or
 * they're just following along.
 */
export function pendingFavourRole(
	favour: PendingFavour,
	viewer: { id: string; isOwner: boolean; isParent: boolean },
): 'doer' | 'decider' | 'viewer' {
	if (favour.doneBy?.memberId === viewer.id) return 'doer';
	if (viewer.isParent) return 'decider';
	if (viewer.isOwner && !favour.escalated) return 'decider';
	return 'viewer';
}

/** Detail screen text for someone who only follows along. */
export const pendingFavourViewerText = (
	favour: PendingFavour,
	ownerName: string | null,
) => {
	const doer = favour.doneBy?.name ?? 'Someone';
	return favour.escalated
		? `${doer} says they did this. A parent will decide.`
		: `${doer} says they did this. Waiting for ${ownerName ?? 'the owner'} to say it's done.`;
};
