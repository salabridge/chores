import { relations, sql } from 'drizzle-orm';
import {
	check,
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
import { completionApprovalStatus } from './completion-approval.ts';
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
 * A favour by a kid (SB-79) starts `pending`: no ledger row and no rotation
 * hand-off until the assignee or a parent approves it (`app.decide_favour`).
 * A pending row is open too, so it blocks a second completion; a declined
 * one isn't, so the chore is open again. Only `approved` rows count as done
 * (streaks, Today, the Overview).
 *
 * Nothing writes this table directly. Completing and reopening go through
 * `app.complete_chore_stage`, `app.complete_chore_instance` and
 * `app.reopen_chore_completion`, plus `app.decide_favour` and
 * `app.escalate_favour` for favours (custom migrations 0011, 0022 and 0024),
 * which check who may act and write the completion and its ledger row in one transaction. See
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
		 * rotation). Their streak counts the period as done, whoever did it.
		 * NULL only if that member was later removed.
		 */
		memberId: uuid('member_id').references(() => householdMembers.id, {
			onDelete: 'set null',
		}),
		/**
		 * Who actually did it, when that wasn't the assignee (SB-74: Mia takes
		 * out Leo's trash as a favour). NULL means the assignee did it. The
		 * points go to this member when it's set (the completion's ledger row is
		 * theirs), but the streak stays with `member_id`. Written only by the
		 * completion functions, which check the doer is in the same household.
		 * NULL too if the doer was later removed; their ledger rows go with
		 * them.
		 */
		doneByMemberId: uuid('done_by_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		/** Points awarded, copied from `chores.points` so later edits don't rewrite history. */
		points: integer('points').notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		/**
		 * Whether it counts yet (SB-79). `pending` and `declined` only happen for
		 * a favour (`done_by_member_id` set when it was written) by someone who
		 * isn't a parent; every other completion is `approved` from the start.
		 */
		approvalStatus: completionApprovalStatus('approval_status')
			.default('approved')
			.notNull(),
		/**
		 * Who last decided a favour: the assignee (also when a parent tapped it
		 * on a managed kid's profile) or the parent who decided it. NULL for a
		 * completion that never needed approval, one still waiting for its
		 * first decision, or when that member was removed.
		 */
		decidedByMemberId: uuid('decided_by_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		/** When `decided_by_member_id` decided it. */
		decidedAt: timestamp('decided_at', { withTimezone: true }),
		/**
		 * When the doer asked a parent to decide (`app.escalate_favour`). From
		 * then on only a parent can decide it, and a parent's decision is final.
		 */
		escalatedAt: timestamp('escalated_at', { withTimezone: true }),
		/** Set when a parent reopens the completion. Only approved rows can be reopened. */
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
			// NO ACTION, not cascade (SB-61): deleting a chore (or its instance) that
			// has a completion must fail, even when the completion committed
			// concurrently. A household delete still works: its own cascade removes
			// the completions before the end-of-statement check.
		}).onDelete('no action'),
		foreignKey({
			name: 'chore_completions_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('no action'),
		// One open completion per instance: completing twice can't award twice.
		// A pending favour is open (it blocks a second completion); a declined one
		// isn't, so the chore can be done again.
		uniqueIndex('chore_completions_instance_id_open_key')
			.on(t.instanceId)
			.where(
				sql`${t.reopenedAt} is null and ${t.approvalStatus} <> 'declined'`,
			),
		// Favours waiting for a decision, per household (Today, the Overview).
		index('chore_completions_household_id_pending_idx')
			.on(t.householdId)
			.where(sql`${t.approvalStatus} = 'pending'`),
		// Reopening takes back points, so it only applies to approved rows.
		check(
			'chore_completions_reopen_approved_check',
			sql`${t.reopenedAt} is null or ${t.approvalStatus} = 'approved'`,
		),
		index('chore_completions_household_id_completed_at_idx').on(
			t.householdId,
			t.completedAt,
		),
		index('chore_completions_member_id_completed_at_idx').on(
			t.memberId,
			t.completedAt,
		),
		// "Chores I did for others".
		index('chore_completions_done_by_member_id_completed_at_idx').on(
			t.doneByMemberId,
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
		doneBy: one(householdMembers, {
			fields: [choreCompletions.doneByMemberId],
			references: [householdMembers.id],
		}),
		decidedBy: one(householdMembers, {
			fields: [choreCompletions.decidedByMemberId],
			references: [householdMembers.id],
		}),
	}),
);
