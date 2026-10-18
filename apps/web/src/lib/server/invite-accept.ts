import { householdInvites, householdMembers, households } from '@chore/db';
import { hashInviteToken } from '@chore/db/invites';
import { and, eq, sql } from 'drizzle-orm';
import type { InviteProblem, InviteView } from '../invite-accept.ts';
import { db } from './drizzle.ts';

// The invite link's landing page (SB-66). Anyone holding the link can see
// which household it's for; accepting needs a signed-in user whose verified
// email matches, which `app.accept_household_invite` checks.

/** Tokens from `createInviteToken()`: 32 bytes, base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export class InviteAcceptError extends Error {
	constructor(readonly problem: InviteProblem) {
		super(problem);
		this.name = 'InviteAcceptError';
	}
}

/** What the link is for, or why it no longer works. */
export async function loadInvite(
	token: string,
	now = new Date(),
): Promise<InviteView> {
	if (!TOKEN.test(token)) return { status: 'not-found' };
	const [row] = await db
		.select({
			email: householdInvites.email,
			role: householdInvites.role,
			expiresAt: householdInvites.expiresAt,
			acceptedAt: householdInvites.acceptedAt,
			householdName: households.name,
			inviterName: householdMembers.displayName,
		})
		.from(householdInvites)
		.innerJoin(households, eq(households.id, householdInvites.householdId))
		.leftJoin(
			householdMembers,
			and(
				eq(householdMembers.householdId, householdInvites.householdId),
				eq(householdMembers.userId, householdInvites.invitedBy),
			),
		)
		.where(eq(householdInvites.tokenHash, hashInviteToken(token)));
	if (!row) return { status: 'not-found' };
	if (row.acceptedAt) return { status: 'accepted' };
	if (row.expiresAt.getTime() <= now.getTime()) return { status: 'expired' };
	return {
		status: 'open',
		email: row.email,
		role: row.role === 'parent' ? 'parent' : 'kid',
		householdName: row.householdName,
		inviterName: row.inviterName,
	};
}

const PROBLEMS: [string, InviteProblem][] = [
	['invite not found', 'not-found'],
	['invite already accepted', 'accepted'],
	['invite expired', 'expired'],
	['invite is for a different email', 'wrong-email'],
	['already a member of this household', 'already-member'],
];

/** Which of `app.accept_household_invite`'s refusals an error is, if any. */
export function inviteProblemOf(e: unknown): InviteProblem | null {
	const messages: string[] = [];
	for (let err = e; err instanceof Error; err = err.cause) {
		messages.push(err.message);
	}
	for (const [text, problem] of PROBLEMS) {
		if (messages.some((m) => m.includes(text))) return problem;
	}
	return null;
}

/**
 * Accepts the invite for `userId` and returns the new member id. The web app
 * connects as the table owner, so the function's `app.current_user_id()` gets
 * the user from claims set here, in the same transaction. `userId` must come
 * from the verified session, never from the request.
 */
export async function acceptInvite(
	userId: string,
	token: string,
): Promise<string> {
	if (!TOKEN.test(token)) throw new InviteAcceptError('not-found');
	try {
		const [, accepted] = await db.batch([
			db.execute(
				sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`,
			),
			db.execute<{ member_id: string }>(
				sql`select app.accept_household_invite(${token}) as member_id`,
			),
		]);
		const memberId = accepted.rows[0]?.member_id;
		if (!memberId) throw new Error('accept_household_invite returned nothing');
		return memberId;
	} catch (e) {
		const problem = inviteProblemOf(e);
		if (problem) throw new InviteAcceptError(problem);
		throw e;
	}
}
