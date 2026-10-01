import { relations, sql } from 'drizzle-orm';
import {
	index,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdParent,
	isMemberIdInHousehold,
} from './rls.ts';

export const chores = pgTable(
	'chores',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		/**
		 * The household member doing the chore (a `household_members.id`, not an
		 * auth user id, so managed kids without a login can be assigned).
		 */
		assignedMemberId: uuid('assigned_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		/** The auth user who created the chore (an audit field, not a member reference). */
		createdBy: uuid('created_by')
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'set null' }),
		dueAt: timestamp('due_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		index('chores_household_id_idx').on(t.householdId),
		index('chores_assigned_member_id_idx').on(t.assignedMemberId),
		pgPolicy('chores_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// Chores are managed by parents. Kids record their part through the
		// completions table (SB-26), not by editing chores. A chore can only be
		// assigned to a member of the same household.
		pgPolicy('chores_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${t.createdBy} = ${currentUserId}
				and ${isMemberIdInHousehold(t.householdId, t.assignedMemberId)}`,
		}),
		pgPolicy('chores_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${isMemberIdInHousehold(t.householdId, t.assignedMemberId)}`,
		}),
		pgPolicy('chores_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const choresRelations = relations(chores, ({ one }) => ({
	household: one(households, {
		fields: [chores.householdId],
		references: [households.id],
	}),
	assignee: one(householdMembers, {
		fields: [chores.assignedMemberId],
		references: [householdMembers.id],
	}),
	creator: one(user, { fields: [chores.createdBy], references: [user.id] }),
}));
