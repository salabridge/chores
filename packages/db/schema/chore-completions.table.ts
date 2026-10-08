import { relations, sql } from 'drizzle-orm';
import {
	foreignKey,
	index,
	integer,
	pgPolicy,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { choreInstances } from './chore-instances.table.ts';
import { chores } from './chores.table.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdMember } from './rls.ts';

/**
 * A finished chore in one period: one row per `chore_instances` row that was
 * completed. Stages are tracked by `chore_stage_progress`; this row appears
 * when the chore as a whole is done (the last stage, or "Mark Done" on a
 * single-step chore) and is what awards the points.
 *
 * Reopening (a parent's Overview action) doesn't delete the row: it sets
 * `reopened_at` and writes a reversing ledger row, so history stays. At most
 * one *open* completion exists per instance (partial unique index), which is
 * what makes completing twice a no-op instead of a double award; after a
 * reopen the chore can be completed again with a new row.
 *
 * Nothing writes this table directly. Completing and reopening go through
 * `app.complete_chore_stage`, `app.complete_chore_instance` and
 * `app.reopen_chore_completion` (custom migration 0011), which check who may
 * act and write the completion and its ledger row in one transaction. See
 * "Completions and points" in ../README.md.
 */
export const choreCompletions = pgTable(
	'chore_completions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		choreId: uuid('chore_id').notNull(),
		instanceId: uuid('instance_id').notNull(),
		/**
		 * Whose chore it was: the instance's assignee (the turn-holder for a
		 * rotation). Points go to this member, even when a parent tapped the
		 * button for a managed kid. NULL only if that member was later removed.
		 */
		memberId: uuid('member_id').references(() => householdMembers.id, {
			onDelete: 'set null',
		}),
		/** Points awarded, copied from `chores.points` so later edits don't rewrite history. */
		points: integer('points').notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		/** Set when a parent reopens the completion. */
		reopenedAt: timestamp('reopened_at', { withTimezone: true }),
		reopenedBy: uuid('reopened_by').references(() => user.id, {
			onDelete: 'set null',
		}),
	},
	(t) => [
		foreignKey({
			name: 'chore_completions_instance_fk',
			columns: [t.instanceId, t.choreId],
			foreignColumns: [choreInstances.id, choreInstances.choreId],
		}).onDelete('cascade'),
		foreignKey({
			name: 'chore_completions_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		// One open completion per instance: completing twice can't award twice.
		uniqueIndex('chore_completions_instance_id_open_key')
			.on(t.instanceId)
			.where(sql`${t.reopenedAt} is null`),
		index('chore_completions_household_id_completed_at_idx').on(
			t.householdId,
			t.completedAt,
		),
		index('chore_completions_member_id_completed_at_idx').on(
			t.memberId,
			t.completedAt,
		),
		pgPolicy('chore_completions_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// No insert/update/delete policies: only the SECURITY DEFINER functions
		// write here.
	],
);

export const choreCompletionsRelations = relations(
	choreCompletions,
	({ one }) => ({
		household: one(households, {
			fields: [choreCompletions.householdId],
			references: [households.id],
		}),
		chore: one(chores, {
			fields: [choreCompletions.choreId],
			references: [chores.id],
		}),
		instance: one(choreInstances, {
			fields: [choreCompletions.instanceId],
			references: [choreInstances.id],
		}),
		member: one(householdMembers, {
			fields: [choreCompletions.memberId],
			references: [householdMembers.id],
		}),
	}),
);
