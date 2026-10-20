import {
	householdInvites,
	householdMembers,
	households,
	user,
} from '@chore/db';
import { createInviteToken } from '@chore/db/invites';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import {
	canManageInvite,
	type InviteInput,
	type InviteRole,
	type PendingInvite,
} from '../invites.ts';
import { MAX_KIDS } from '../setup.ts';
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
//
// Every invite can become an email from our sending domain, so a household
// has at most `MAX_PENDING_INVITES` open at once, a resend has to wait a
// minute after the last one, and an invite can't be renewed past 30 days.

/** Open (unaccepted, unexpired) invites a household may have at once. */
export const MAX_PENDING_INVITES = 20;

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
 * the parent resends it instead. Refused when the household already has
 * `MAX_PENDING_INVITES` open invites, or for a kid invite when its kids plus
 * open kid invites would pass `MAX_KIDS`. Those are counted and the invite
 * inserted behind a lock on the household row, like adding a managed kid.
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
	let inserted: { rows: unknown[] };
	try {
		[, , inserted] = await db.batch([
			db.execute(
				sql`select 1 from households where id = ${actor.householdId} for update`,
			),
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
			// A new statement, so it counts what committed while it waited.
			db.execute<{ id: string }>(sql`
				insert into household_invites
					(household_id, email, role, display_name, birth_year, token_hash, invited_by)
				select ${actor.householdId}::uuid, ${input.email}::text, ${input.role}::household_role,
					${input.displayName}::text, ${input.birthYear}::smallint, ${tokenHash}::text,
					${actor.userId}::uuid
				where (select count(*) from household_invites
						where household_id = ${actor.householdId}
							and accepted_at is null and expires_at > now()) < ${MAX_PENDING_INVITES}
					and (${input.role}::text <> 'kid' or (
						(select count(*) from household_members
							where household_id = ${actor.householdId} and role = 'kid'
								and removed_at is null)
						+ (select count(*) from household_invites
							where household_id = ${actor.householdId} and role = 'kid'
								and accepted_at is null and expires_at > now())
					) < ${MAX_KIDS})
				returning id`),
		]);
	} catch (e) {
		if (isUniqueViolation(e)) {
			throw new MemberError(
				`${input.email} already has a pending invite. Resend it instead.`,
			);
		}
		throw e;
	}
	if (inserted.rows.length === 0) {
		throw new MemberError(
			'Your household has reached its limit of kids or pending invites.',
		);
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
 * token with who it's for. The old link stops working. Refused within a
 * minute of the last link, and for an invite made more than 30 days ago, so
 * a parent can't keep one alive (or keep emailing it) forever.
 */
export async function resendInvite(
	actor: Actor,
	inviteId: string,
): Promise<{ token: string; email: string; role: InviteRole }> {
	const { token, tokenHash } = createInviteToken();
	const [updated] = await db
		.update(householdInvites)
		.set({
			tokenHash,
			expiresAt: sql`now() + interval '7 days'`,
			lastSentAt: sql`now()`,
		})
		.where(
			and(
				manageable(actor, inviteId),
				sql`${householdInvites.lastSentAt} < now() - interval '1 minute'`,
				sql`${householdInvites.createdAt} > now() - interval '30 days'`,
			),
		)
		.returning({ email: householdInvites.email, role: householdInvites.role });
	if (!updated) throw await resendRefusal(actor, inviteId);
	return {
		token,
		email: updated.email,
		role: updated.role === 'parent' ? 'parent' : 'kid',
	};
}

/** The household's name, for the invite email. */
export async function householdName(householdId: string): Promise<string> {
	const [row] = await db
		.select({ name: households.name })
		.from(households)
		.where(eq(households.id, householdId));
	return row?.name ?? 'your household';
}

/** Why `resendInvite` changed nothing, worded for the parent. */
async function resendRefusal(
	actor: Actor,
	inviteId: string,
): Promise<MemberError> {
	const [invite] = await db
		.select({
			tooSoon: sql<boolean>`${householdInvites.lastSentAt} >= now() - interval '1 minute'`,
		})
		.from(householdInvites)
		.where(manageable(actor, inviteId));
	if (!invite) return new MemberError('That invite was not found.');
	return new MemberError(
		invite.tooSoon
			? 'You just sent a new link. Wait a minute before sending another.'
			: 'This invite is more than 30 days old. Revoke it and invite them again.',
	);
}
