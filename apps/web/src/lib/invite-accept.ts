import type { InviteRole } from './invites.ts';
import { joinNames, plural } from './overview.ts';

// The invite link's landing page (SB-66): what it shows, shared by the page
// load, the accept form, and the component.

/** Why an invite can't be accepted. */
export type InviteProblem =
	| 'not-found'
	| 'accepted'
	| 'expired'
	| 'wrong-email'
	| 'unverified'
	| 'already-member'
	| 'already-in-household'
	| 'household-full'
	| 'not-owner'
	| 'same-household';

export type InviteView =
	| {
			status: 'open';
			/** Who the invite is for. Only shown to someone holding the link. */
			email: string;
			role: InviteRole;
			householdName: string;
			/** The inviting parent's name in the household, if they're still in it. */
			inviterName: string | null;
	  }
	| { status: 'not-found' | 'accepted' | 'expired' };

export const PROBLEM_MESSAGES: Record<InviteProblem, string> = {
	'not-found':
		"This invite link doesn't work. It may have been revoked, or replaced by a newer link. Ask for a new one.",
	accepted: 'This invite has already been used.',
	expired:
		'This invite has expired. Ask the parent who sent it for a new link.',
	'wrong-email':
		'This invite is for a different email address. Sign in with the address it was sent to, or ask for an invite to this one.',
	unverified:
		'Verify your email address before you join. We will email you a code.',
	'already-member': "You're already in this household.",
	'already-in-household':
		"You're already in a household. Ask its owner to remove you before joining another one.",
	'household-full':
		'This household already has as many kids as it can. Ask the parent who invited you.',
	// From moving a household in (SB-76).
	'not-owner':
		'Only an owner of your household can move it. Ask them, or leave it and join on your own.',
	'same-household': "That's the household this invite is for.",
};

/**
 * The household the signed-in user is already in, when that's what stops them
 * accepting (SB-76). An owner can move it into the invite's household (`merge`
 * says what that takes along and deletes); anyone else can leave it first.
 */
export interface CurrentHousehold {
	id: string;
	name: string;
	role: 'owner' | 'parent' | 'kid';
	/** Present for an owner. */
	merge: MergeSummary | null;
}

export interface MergeSummary {
	/** Everyone in the household, in the order they joined, with their points. */
	members: { displayName: string; points: number; you: boolean }[];
	/** What's deleted with the household. */
	chores: number;
	rewards: number;
	completions: number;
}

/** "Mia, Leo and Sam will join Burbridge Household with you; their points come with them." */
export function mergeMovesText(merge: MergeSummary, target: string): string {
	const others = merge.members.filter((m) => !m.you).map((m) => m.displayName);
	if (others.length === 0) return `You'll join ${target} on your own.`;
	return `${joinNames(others)} will join ${target} with you; their points come with them.`;
}

/** "Its 4 chores, 2 rewards and history (12 completed chores) are deleted." */
export function mergeDeletesText(merge: MergeSummary): string {
	return `Its ${plural(merge.chores, 'chore')}, ${plural(merge.rewards, 'reward')} and history (${plural(merge.completions, 'completed chore')}) are deleted. Streaks start fresh.`;
}

/** Whether what was typed into the confirm box is the household's name. */
export function confirmsHouseholdName(typed: unknown, name: string): boolean {
	return (
		typeof typed === 'string' &&
		typed.trim().toLowerCase() === name.trim().toLowerCase()
	);
}

/**
 * Why the signed-in user can't accept an open invite, or null if they can.
 * The database checks the same things; this is for a clear message up front.
 */
export function signedInProblem(
	invite: { email: string },
	user: { email: string; emailVerified: boolean },
): InviteProblem | null {
	if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
		return 'wrong-email';
	}
	if (!user.emailVerified) return 'unverified';
	return null;
}
