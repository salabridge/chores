import {
	householdInvites,
	householdMembers,
	households,
	pointsLedger,
} from '@chore/db';
import { hashInviteToken } from '@chore/db/invites';
import { and, asc, eq, isNull, type SQL, sql } from 'drizzle-orm';
import type {
	CurrentHousehold,
	InviteProblem,
	InviteView,
} from '../invite-accept.ts';
import { isUuid } from '../rewards.ts';
import { db } from './drizzle.ts';

// The invite link's landing page (SB-66). Anyone holding the link can see
// which household it's for; accepting needs a signed-in user whose verified
// email matches, which `app.accept_household_invite` checks. Someone already
// in a household can leave it first, or, as its owner, move it into the
// invite's household (SB-76, `app.merge_household_via_invite`).

/** Tokens from `createInviteToken()`: 32 bytes, base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Whether a value can be an invite token (which also makes it safe in a path). */
export const isInviteToken = (token: unknown): token is string =>
	typeof token === 'string' && TOKEN.test(token);

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
	return (await readInvite(token, now)).view;
}

/**
 * `loadInvite`, plus the invite's household id (null unless the invite is
 * open), so the page can tell "already in this household" from "in another
 * one". The id stays on the server.
 */
export async function readInvite(
	token: string,
	now = new Date(),
): Promise<{ view: InviteView; householdId: string | null }> {
	const closed = (status: 'not-found' | 'accepted' | 'expired') => ({
		view: { status },
		householdId: null,
	});
	if (!TOKEN.test(token)) return closed('not-found');
	const [row] = await db
		.select({
			householdId: householdInvites.householdId,
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
	if (!row) return closed('not-found');
	if (row.acceptedAt) return closed('accepted');
	if (row.expiresAt.getTime() <= now.getTime()) return closed('expired');
	return {
		view: {
			status: 'open',
			email: row.email,
			role: row.role === 'parent' ? 'parent' : 'kid',
			householdName: row.householdName,
			inviterName: row.inviterName,
		},
		householdId: row.householdId,
	};
}

// `app.accept_household_invite` (migration 0020) and
// `app.merge_household_via_invite` (0023) raise each refusal with a stable
// HINT; the message text isn't a contract.
const PROBLEMS: Partial<Record<string, InviteProblem>> = {
	'invite-not-found': 'not-found',
	'invite-accepted': 'accepted',
	'invite-expired': 'expired',
	'wrong-email': 'wrong-email',
	'already-in-household': 'already-in-household',
	'household-full': 'household-full',
	'not-owner': 'not-owner',
	'same-household': 'same-household',
};

/** Which of the accept / merge functions' refusals an error is, if any. */
export function inviteProblemOf(e: unknown): InviteProblem | null {
	for (let err = e; err instanceof Error; err = err.cause) {
		const { hint, code } = err as { hint?: string; code?: string };
		const problem = hint ? PROBLEMS[hint] : undefined;
		if (problem) return problem;
		// Two tabs accepting at once: the second insert hits the unique
		// (household, user) index.
		if (code === '23505') return 'already-member';
	}
	return null;
}

/**
 * The household the user is already in, if any (SB-76), and for its owner
 * what moving it would take along and delete. A user is in at most one
 * household; with older data that broke that rule, the oldest membership wins.
 */
export async function loadCurrentHousehold(
	userId: string,
): Promise<CurrentHousehold | null> {
	const [membership] = await db
		.select({
			id: households.id,
			name: households.name,
			role: householdMembers.role,
		})
		.from(householdMembers)
		.innerJoin(households, eq(households.id, householdMembers.householdId))
		.where(
			and(
				eq(householdMembers.userId, userId),
				isNull(householdMembers.removedAt),
			),
		)
		.orderBy(asc(householdMembers.joinedAt))
		.limit(1);
	if (!membership) return null;
	if (membership.role !== 'owner') return { ...membership, merge: null };

	const [members, [counts]] = await Promise.all([
		db
			.select({
				displayName: householdMembers.displayName,
				userId: householdMembers.userId,
				points: sql<number>`coalesce((
					select sum(${pointsLedger.delta}) from ${pointsLedger}
					where ${pointsLedger.memberId} = ${householdMembers.id}
				), 0)::int`,
			})
			.from(householdMembers)
			// Removed members (SB-84) don't move with a merge.
			.where(
				and(
					eq(householdMembers.householdId, membership.id),
					isNull(householdMembers.removedAt),
				),
			)
			.orderBy(asc(householdMembers.joinedAt), asc(householdMembers.id)),
		db
			.select({
				chores: sql<number>`(select count(*) from chores c where c.household_id = ${households.id})::int`,
				rewards: sql<number>`(select count(*) from rewards r where r.household_id = ${households.id})::int`,
				completions: sql<number>`(select count(*) from chore_completions cc where cc.household_id = ${households.id} and cc.reopened_at is null and cc.approval_status = 'approved')::int`,
			})
			.from(households)
			.where(eq(households.id, membership.id)),
	]);
	return {
		...membership,
		merge: {
			members: members.map(({ userId: memberUserId, ...member }) => ({
				...member,
				you: memberUserId === userId,
			})),
			chores: counts?.chores ?? 0,
			rewards: counts?.rewards ?? 0,
			completions: counts?.completions ?? 0,
		},
	};
}

/** Sets the user's claims, then runs `call` in the same transaction. */
async function asUser(userId: string, call: SQL) {
	const [, result] = await db.batch([
		db.execute(
			sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`,
		),
		db.execute<{ member_id: string }>(call),
	]);
	return result.rows[0]?.member_id;
}

/** Runs an accept-style call, turning its refusals into `InviteAcceptError`s. */
async function accepting(run: () => Promise<string | undefined>, fn: string) {
	try {
		const memberId = await run();
		if (!memberId) throw new Error(`${fn} returned nothing`);
		return memberId;
	} catch (e) {
		const problem = inviteProblemOf(e);
		if (problem) throw new InviteAcceptError(problem);
		throw e;
	}
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
	return accepting(
		() =>
			asUser(
				userId,
				sql`select app.accept_household_invite(${token}) as member_id`,
			),
		'accept_household_invite',
	);
}

/**
 * Accepts the invite by moving `householdId` into the invite's household
 * (SB-76): every member moves with their points, and the old household is
 * deleted with its chores, rewards and history. Returns the user's new member
 * id. `app.merge_household_via_invite` checks the invite and that the user is
 * an owner of `householdId`, all in one transaction. `userId` must come from
 * the verified session; `householdId` is the household the user confirmed,
 * and the database refuses it unless they own it.
 */
export async function mergeHouseholdViaInvite(
	userId: string,
	token: string,
	householdId: string,
): Promise<string> {
	if (!TOKEN.test(token)) throw new InviteAcceptError('not-found');
	if (!isUuid(householdId)) throw new InviteAcceptError('not-owner');
	return accepting(
		() =>
			asUser(
				userId,
				sql`select app.merge_household_via_invite(${token}, ${householdId}::uuid) as member_id`,
			),
		'merge_household_via_invite',
	);
}

/**
 * Removes `userId`'s own membership of `householdId`, so they can accept an
 * invite to another one (SB-76). Anyone may leave, as the RLS delete policy
 * allows, except a household's only owner. Their points, claims and PIN there
 * go with the membership, and any of their device profiles acting as one of
 * its kids falls back to their own view. Returns false when nothing was
 * removed (not a member, or the only owner).
 *
 * The household row is locked first, so two owners leaving at once can't
 * each see the other one still there.
 */
export async function leaveHousehold(
	userId: string,
	householdId: string,
): Promise<boolean> {
	if (!isUuid(householdId)) return false;
	const [, , left] = await db.batch([
		db.execute(
			sql`select 1 from households where id = ${householdId} for update`,
		),
		db.execute(sql`
			update device_profiles d set active_member_id = null
			from household_members k
			where d.user_id = ${userId}
				and k.id = d.active_member_id
				and k.household_id = ${householdId}`),
		db.execute<{ id: string }>(sql`
			delete from household_members m
			where m.user_id = ${userId}
				and m.household_id = ${householdId}
				and (m.role <> 'owner' or exists (
					select 1 from household_members o
					where o.household_id = m.household_id
						and o.role = 'owner'
						and o.removed_at is null
						and o.id <> m.id
				))
			returning m.id`),
	]);
	return left.rows.length > 0;
}
