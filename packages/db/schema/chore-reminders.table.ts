import { relations, sql } from 'drizzle-orm';
import {
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
import {
	backendRole,
	isHouseholdMember,
	isHouseholdParent,
	isMemberIdInHousehold,
} from './rls.ts';

/**
 * A parent's nudge to the person on a chore (the Overview "Remind" action,
 * SB-29). MVP delivery is in-app only: the assignee's Today screen shows a
 * banner for their undismissed reminders. No push or email.
 *
 * Reminders are a log, never edited except to dismiss: `dismissed_at` is set
 * when the assignee has seen it. Reminding twice writes two rows.
 */
export const choreReminders = pgTable(
	'chore_reminders',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		choreId: uuid('chore_id').notNull(),
		/** Who was nudged: whoever held the chore when the parent tapped Remind. */
		assigneeMemberId: uuid('assignee_member_id')
			.notNull()
			.references(() => householdMembers.id, { onDelete: 'cascade' }),
		/** The signed-in account that sent it (a parent). */
		createdBy: uuid('created_by').references(() => user.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		/** Set when the assignee dismisses the banner. */
		dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
	},
	(t) => [
		foreignKey({
			name: 'chore_reminders_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		// The Today banner: one member's open reminders, newest first.
		index('chore_reminders_assignee_member_id_created_at_idx').on(
			t.assigneeMemberId,
			t.createdAt,
		),
		index('chore_reminders_household_id_created_at_idx').on(
			t.householdId,
			t.createdAt,
		),
		pgPolicy('chore_reminders_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('chore_reminders_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${isMemberIdInHousehold(t.householdId, t.assigneeMemberId)}`,
		}),
		// Dismissing is for the assignee or a parent; both are household members
		// as far as RLS goes, and the app narrows it further.
		pgPolicy('chore_reminders_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
			withCheck: isHouseholdMember(t.householdId),
		}),
	],
);

export const choreRemindersRelations = relations(choreReminders, ({ one }) => ({
	household: one(households, {
		fields: [choreReminders.householdId],
		references: [households.id],
	}),
	chore: one(chores, {
		fields: [choreReminders.choreId],
		references: [chores.id],
	}),
	assignee: one(householdMembers, {
		fields: [choreReminders.assigneeMemberId],
		references: [householdMembers.id],
	}),
}));
