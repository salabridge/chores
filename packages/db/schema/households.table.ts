import { relations, sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { chores } from './chores.table.ts';
import { householdMembers } from './household-members.table.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdOwner,
} from './rls.ts';

export const households = pgTable(
	'households',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		// Whoever creates a household becomes its first owner (see the
		// `households_add_creator` trigger in the custom migrations).
		createdBy: uuid('created_by')
			.notNull()
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		// The creator can see the row too, so `insert ... returning` works
		// before the membership trigger's row is visible.
		pgPolicy('households_select', {
			for: 'select',
			to: backendRole,
			using: sql`${isHouseholdMember(t.id)} or ${t.createdBy} = ${currentUserId}`,
		}),
		pgPolicy('households_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${t.createdBy} = ${currentUserId}`,
		}),
		pgPolicy('households_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdOwner(t.id),
			withCheck: isHouseholdOwner(t.id),
		}),
		pgPolicy('households_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdOwner(t.id),
		}),
	],
);

export const householdsRelations = relations(households, ({ one, many }) => ({
	creator: one(user, { fields: [households.createdBy], references: [user.id] }),
	members: many(householdMembers),
	chores: many(chores),
}));
