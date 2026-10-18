import type { InviteRole } from './invites.ts';

// The invite link's landing page (SB-66): what it shows, shared by the page
// load, the accept form, and the component.

/** Why an invite can't be accepted. */
export type InviteProblem =
	| 'not-found'
	| 'accepted'
	| 'expired'
	| 'wrong-email'
	| 'unverified'
	| 'already-member';

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
	unverified: 'Verify your email address first, then open the link again.',
	'already-member': "You're already in this household.",
};

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
