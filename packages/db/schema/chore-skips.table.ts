import { relations } from 'drizzle-orm';
import {
	date,
	foreignKey,
	index,
	pgPolicy,
	pgTable,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { chores } from './chores.table.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdMember, isHouseholdParent } from './rls.ts';

/**
 * A parent's Skip on the Overview (SB-29). Skipping awards no points and
 * writes no completion; this row is the record, so the Overview can show
 * "reminders or skips".
 *
 * - A rotation chore: the turn moves to the next eligible member
 *   (`app.advance_chore_rotation(..., false)`), and `member_id` is whose turn
 *   was skipped.
 * - A personal chore: the chore is marked skipped for `period_start`, and
 *   `member_id` is its assignee.
 *
 * `period_start` is the same value as `chore_instances.period_start`, but
 * there's no foreign key to an instance: rows are created lazily, so a period
 * nobody touched has none, and a skip shouldn't have to make one.
 */
export const choreSkips = pgTable(
	'chore_skips',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		choreId: uuid('chore_id').notNull(),
		periodStart: date('period_start').notNull(),
		/** Whose turn (or personal chore) was skipped. NULL if they were later removed. */
		memberId: uuid('member_id').references(() => householdMembers.id, {
			onDelete: 'set null',
		}),
		/** The signed-in account that skipped it (a parent). */
		createdBy: uuid('created_by').references(() => user.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		foreignKey({
			name: 'chore_skips_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		index('chore_skips_chore_id_period_start_idx').on(t.choreId, t.periodStart),
		index('chore_skips_household_id_created_at_idx').on(
			t.householdId,
			t.createdAt,
		),
		pgPolicy('chore_skips_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('chore_skips_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: isHouseholdParent(t.householdId),
		}),
	],
);

export const choreSkipsRelations = relations(choreSkips, ({ one }) => ({
	household: one(households, {
		fields: [choreSkips.householdId],
		references: [households.id],
	}),
	chore: one(chores, {
		fields: [choreSkips.choreId],
		references: [chores.id],
	}),
	member: one(householdMembers, {
		fields: [choreSkips.memberId],
		references: [householdMembers.id],
	}),
}));
