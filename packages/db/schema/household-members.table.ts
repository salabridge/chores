import { relations, sql } from 'drizzle-orm';
import {
	index,
	pgEnum,
	pgPolicy,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { households } from './households.table.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdOwner,
} from './rls.ts';

export const householdRole = pgEnum('household_role', ['owner', 'member']);

export const householdMembers = pgTable(
	'household_members',
	{
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: householdRole('role').notNull().default('member'),
		joinedAt: timestamp('joined_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.householdId, t.userId] }),
		index('household_members_user_id_idx').on(t.userId),
		pgPolicy('household_members_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// Only owners add, change, or remove members; anyone can leave.
		pgPolicy('household_members_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: isHouseholdOwner(t.householdId),
		}),
		pgPolicy('household_members_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdOwner(t.householdId),
			withCheck: isHouseholdOwner(t.householdId),
		}),
		pgPolicy('household_members_delete', {
			for: 'delete',
			to: backendRole,
			using: sql`${isHouseholdOwner(t.householdId)} or ${t.userId} = ${currentUserId}`,
		}),
	],
);

export const householdMembersRelations = relations(
	householdMembers,
	({ one }) => ({
		household: one(households, {
			fields: [householdMembers.householdId],
			references: [households.id],
		}),
		user: one(user, {
			fields: [householdMembers.userId],
			references: [user.id],
		}),
	}),
);
