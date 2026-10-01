import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { householdMembers } from './household-members.table.ts';
import { householdRole } from './household-role.ts';
import { households } from './households.table.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdOwner,
	isHouseholdParent,
} from './rls.ts';

/**
 * An email invitation to join a household as a kid or a parent. The invitee
 * signs up (or in) through the normal auth flow and then calls
 * `app.accept_household_invite(token)`, which checks the invite and their
 * verified email and attaches their auth user to a new member row.
 *
 * Only a hash of the token is stored (`token_hash`: lowercase hex SHA-256 of
 * the token, see `hashInviteToken` in ../src/invites.ts), so a database leak
 * doesn't leak working invite links.
 *
 * Invites are issued by a parent, so accepting one needs no further approval.
 */
export const householdInvites = pgTable(
	'household_invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: householdRole('role').notNull().default('kid'),
		/** Display name for the new member row; NULL uses the auth user's name. */
		displayName: text('display_name'),
		tokenHash: text('token_hash').notNull(),
		invitedBy: uuid('invited_by')
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'set null' }),
		expiresAt: timestamp('expires_at', { withTimezone: true })
			.notNull()
			.default(sql`now() + interval '7 days'`),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }),
		/** The member row created when the invite was accepted. */
		acceptedMemberId: uuid('accepted_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		uniqueIndex('household_invites_token_hash_key').on(t.tokenHash),
		// At most one open invite per email per household.
		uniqueIndex('household_invites_household_id_email_key')
			.on(t.householdId, sql`lower(${t.email})`)
			.where(sql`${t.acceptedAt} is null`),
		index('household_invites_household_id_idx').on(t.householdId),
		check('household_invites_role_check', sql`${t.role} <> 'owner'`),
		check(
			'household_invites_email_check',
			sql`${t.email} ~ '^[^@\\s]+@[^@\\s]+$'`,
		),
		check(
			'household_invites_token_hash_check',
			sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			'household_invites_display_name_check',
			sql`${t.displayName} is null or char_length(btrim(${t.displayName})) between 1 and 50`,
		),
		pgPolicy('household_invites_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
		// Parents invite kids; only owners invite parents.
		pgPolicy('household_invites_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${t.invitedBy} = ${currentUserId}
				and ${t.acceptedAt} is null
				and ${t.acceptedMemberId} is null
				and (${isHouseholdOwner(t.householdId)}
					or (${isHouseholdParent(t.householdId)} and ${t.role} = 'kid'))`,
		}),
		// Revoking an invite is deleting it. There's no update policy: accepting
		// goes through app.accept_household_invite, which runs as the owner.
		pgPolicy('household_invites_delete', {
			for: 'delete',
			to: backendRole,
			using: sql`${isHouseholdOwner(t.householdId)}
				or (${isHouseholdParent(t.householdId)} and ${t.role} = 'kid')`,
		}),
	],
);

export const householdInvitesRelations = relations(
	householdInvites,
	({ one }) => ({
		household: one(households, {
			fields: [householdInvites.householdId],
			references: [households.id],
		}),
		inviter: one(user, {
			fields: [householdInvites.invitedBy],
			references: [user.id],
		}),
		acceptedMember: one(householdMembers, {
			fields: [householdInvites.acceptedMemberId],
			references: [householdMembers.id],
		}),
	}),
);
