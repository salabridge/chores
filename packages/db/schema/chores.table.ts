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
import { households } from './households.table.ts';
import { backendRole, currentUserId, isHouseholdMember } from './rls.ts';

export const chores = pgTable(
	'chores',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		assignedTo: uuid('assigned_to').references(() => user.id, {
			onDelete: 'set null',
		}),
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
		index('chores_assigned_to_idx').on(t.assignedTo),
		pgPolicy('chores_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// A chore can only be assigned to someone in the same household.
		pgPolicy('chores_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdMember(t.householdId)}
				and ${t.createdBy} = ${currentUserId}
				and (${t.assignedTo} is null or app.is_member_of(${t.householdId}, ${t.assignedTo}))`,
		}),
		pgPolicy('chores_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
			withCheck: sql`${isHouseholdMember(t.householdId)}
				and (${t.assignedTo} is null or app.is_member_of(${t.householdId}, ${t.assignedTo}))`,
		}),
		pgPolicy('chores_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
	],
);

export const choresRelations = relations(chores, ({ one }) => ({
	household: one(households, {
		fields: [chores.householdId],
		references: [households.id],
	}),
	assignee: one(user, { fields: [chores.assignedTo], references: [user.id] }),
	creator: one(user, { fields: [chores.createdBy], references: [user.id] }),
}));
