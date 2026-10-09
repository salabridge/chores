import { relations, sql } from 'drizzle-orm';
import {
	check,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { chores } from './chores.table.ts';
import { householdInvites } from './household-invites.table.ts';
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
		/**
		 * IANA time zone ("America/Chicago") the household's days are counted in.
		 * Streaks (SB-28) and "today" use it, so a chore done at 11:30 PM local
		 * counts for that day on a UTC server. Validate with `isValidTimeZone()`
		 * in ../src/recurrence.ts before saving; the database only checks the
		 * length.
		 */
		timezone: text('timezone').notNull().default('UTC'),
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
		check(
			'households_timezone_check',
			sql`char_length(${t.timezone}) between 1 and 64`,
		),
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
	invites: many(householdInvites),
}));
