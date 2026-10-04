import { relations, sql } from 'drizzle-orm';
import {
	check,
	foreignKey,
	index,
	integer,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { choreCompletions } from './chore-completions.table.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { pointsReason } from './points-reason.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdParent,
} from './rls.ts';

/**
 * Every change to a member's points, append-only. A member's balance is the
 * sum of their `delta`s (`memberPointsBalance()` in ../src/completions.ts);
 * there is no mutable counter to drift. Rows are never updated or deleted
 * (no policies for either, and the table grants don't include them); a
 * correction is a new row.
 *
 * - `completion` and `reversal` rows point at their `chore_completions` row
 *   (`completion_id`). A partial unique index per reason allows at most one
 *   of each per completion, which is the idempotency guarantee.
 * - `reward_claim` rows are written by the rewards work (SB-27), which adds
 *   its own source column.
 * - `adjustment` rows are a parent's manual correction, with a `note`.
 *
 * Completion and reversal rows are written by the SECURITY DEFINER functions
 * (custom migration 0011); parents can insert adjustments directly.
 */
export const pointsLedger = pgTable(
	'points_ledger',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		/** Whose points. Leaving the household removes the member's ledger rows. */
		memberId: uuid('member_id').notNull(),
		/** Points gained (positive) or lost (negative). Never 0. */
		delta: integer('delta').notNull(),
		reason: pointsReason('reason').notNull(),
		/**
		 * The completion a `completion` / `reversal` row belongs to. NULL if the
		 * chore was later deleted: the points stay, only the link goes.
		 */
		completionId: uuid('completion_id').references(() => choreCompletions.id, {
			onDelete: 'set null',
		}),
		/** Free text, required for adjustments ("Helped with groceries"). */
		note: text('note'),
		/** The auth user who caused it (an audit field, not a member reference). */
		createdBy: uuid('created_by')
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		foreignKey({
			name: 'points_ledger_member_fk',
			columns: [t.memberId, t.householdId],
			foreignColumns: [householdMembers.id, householdMembers.householdId],
		}).onDelete('cascade'),
		check('points_ledger_delta_check', sql`${t.delta} <> 0`),
		check(
			'points_ledger_source_check',
			sql`${t.reason} in ('completion', 'reversal') or ${t.completionId} is null`,
		),
		check(
			'points_ledger_sign_check',
			sql`(${t.reason} <> 'completion' or ${t.delta} > 0)
				and (${t.reason} not in ('reversal', 'reward_claim') or ${t.delta} < 0)`,
		),
		check(
			'points_ledger_note_check',
			sql`(${t.note} is null or char_length(${t.note}) <= 200)
				and (${t.reason} <> 'adjustment' or char_length(btrim(${t.note})) >= 1)`,
		),
		// At most one award and one reversal per completion.
		uniqueIndex('points_ledger_completion_id_completion_key')
			.on(t.completionId)
			.where(sql`${t.reason} = 'completion'`),
		uniqueIndex('points_ledger_completion_id_reversal_key')
			.on(t.completionId)
			.where(sql`${t.reason} = 'reversal'`),
		index('points_ledger_member_id_created_at_idx').on(t.memberId, t.createdAt),
		index('points_ledger_household_id_created_at_idx').on(
			t.householdId,
			t.createdAt,
		),
		pgPolicy('points_ledger_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// Parents can correct a balance by hand. Everything else is written by
		// the completion functions.
		pgPolicy('points_ledger_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${t.reason} = 'adjustment'
				and ${t.createdBy} = ${currentUserId}`,
		}),
	],
);

export const pointsLedgerRelations = relations(pointsLedger, ({ one }) => ({
	household: one(households, {
		fields: [pointsLedger.householdId],
		references: [households.id],
	}),
	member: one(householdMembers, {
		fields: [pointsLedger.memberId],
		references: [householdMembers.id],
	}),
	completion: one(choreCompletions, {
		fields: [pointsLedger.completionId],
		references: [choreCompletions.id],
	}),
}));
