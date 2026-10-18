import { householdInvites, householdMembers, user } from '@chore/db';
import { createInviteToken } from '@chore/db/invites';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import {
	canManageInvite,
	type InviteInput,
	type PendingInvite,
} from '../invites.ts';
import { db } from './drizzle.ts';
import { MemberError } from './members.ts';
import type { MemberSummary } from './profile-state.ts';
import { isUniqueViolation } from './setup.ts';

// Household invites (SB-66). The web app talks to Postgres as the table
// owner, so the `household_invites` RLS policies don't apply here: this
// module repeats them (owners handle any invite, parents only kid invites)
// and scopes every query by the actor's own household.
//
// Only the token's hash is stored, so a link can only be shown right after
// it's made. Resending makes a new token, and the old link stops working.

type Actor = Pick<MemberSummary, 'householdId' | 'role' | 'userId'>;

const sameEmail = (email: string) =>
	sql`lower(${householdInvites.email}) = lower(${email})`;

/** Invites in the household nobody has accepted yet, oldest first. */
export async function listPendingInvites(
	householdId: string,
): Promise<PendingInvite[]> {
	return db
		.select({
			id: householdInvites.id,
			email: householdInvites.email,
			role: householdInvites.role,
			displayName: householdInvites.displayName,
			expiresAt: householdInvites.expiresAt,
		})
		.from(householdInvites)
		.where(
			and(
				eq(householdInvites.householdId, householdId),
				isNull(householdInvites.acceptedAt),
			),
		)
		.orderBy(asc(householdInvites.createdAt))
		.then((rows) =>
			// `household_invites_role_check` keeps 'owner' out.
			rows.map((row) => ({
				...row,
				role: row.role === 'parent' ? 'parent' : 'kid',
			})),
		);
}

/**
 * Creates an invite and returns its token (for the link). An expired invite
 * for the same email is replaced; a live one is left alone and reported, so
 * the parent resends it instead.
 */
export async function createInvite(
	actor: Actor,
	input: InviteInput,
): Promise<string> {
	if (!canManageInvite(actor.role, input.role)) {
		throw new MemberError('Only the household owner can invite a parent.');
	}

	const [existing] = await db
		.select({ id: householdMembers.id })
		.from(householdMembers)
		.innerJoin(user, eq(user.id, householdMembers.userId))
		.where(
			and(
				eq(householdMembers.householdId, actor.householdId),
				sql`lower(${user.email}) = lower(${input.email})`,
			),
		);
	if (existing) {
		throw new MemberError(`${input.email} is already in your household.`);
	}

	const { token, tokenHash } = createInviteToken();
	try {
		await db.batch([
			db
				.delete(householdInvites)
				.where(
					and(
						eq(householdInvites.householdId, actor.householdId),
						sameEmail(input.email),
						isNull(householdInvites.acceptedAt),
						lte(householdInvites.expiresAt, sql`now()`),
					),
				),
			db.insert(householdInvites).values({
				householdId: actor.householdId,
				email: input.email,
				role: input.role,
				displayName: input.displayName,
				birthYear: input.birthYear,
				tokenHash,
				invitedBy: actor.userId,
			}),
		]);
	} catch (e) {
		if (isUniqueViolation(e)) {
			throw new MemberError(
				`${input.email} already has a pending invite. Resend it instead.`,
			);
		}
		throw e;
	}
	return token;
}

/** The pending invite, if this actor may revoke or resend it. */
function manageable(actor: Actor, inviteId: string) {
	if (actor.role === 'kid') return sql`false`;
	return and(
		eq(householdInvites.id, inviteId),
		eq(householdInvites.householdId, actor.householdId),
		isNull(householdInvites.acceptedAt),
		// Only owners handle parent invites.
		actor.role === 'owner' ? undefined : eq(householdInvites.role, 'kid'),
	);
}

/** Deletes a pending invite, so its link stops working. */
export async function revokeInvite(
	actor: Actor,
	inviteId: string,
): Promise<void> {
	const removed = await db
		.delete(householdInvites)
		.where(manageable(actor, inviteId))
		.returning({ id: householdInvites.id });
	if (removed.length === 0) {
		throw new MemberError('That invite was not found.');
	}
}

/**
 * Gives a pending invite a new token and a fresh 7 days, and returns the new
 * token. The old link stops working.
 */
export async function resendInvite(
	actor: Actor,
	inviteId: string,
): Promise<string> {
	const { token, tokenHash } = createInviteToken();
	const updated = await db
		.update(householdInvites)
		.set({ tokenHash, expiresAt: sql`now() + interval '7 days'` })
		.where(manageable(actor, inviteId))
		.returning({ id: householdInvites.id });
	if (updated.length === 0) {
		throw new MemberError('That invite was not found.');
	}
	return token;
}
