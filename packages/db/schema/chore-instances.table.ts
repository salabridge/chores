import { relations, sql } from 'drizzle-orm';
import {
	date,
	foreignKey,
	index,
	pgPolicy,
	pgTable,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';
import { choreStageProgress } from './chore-stage-progress.table.ts';
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
 * One period of a recurring chore: today's "Make bed", this week's "Mow the
 * lawn". This is what resets: a new period is a new row, so nothing is ever
 * cleared. See "Recurrence" in ../README.md for why.
 *
 * Rows are created lazily, the first time someone opens or works on the chore
 * in a period (`insert ... on conflict (chore_id, period_start) do nothing`).
 * A period with no row is a period nobody touched, which SB-28 (streaks)
 * treats as missed. `period_start` comes from `chorePeriodStart()` in
 * ../src/recurrence.ts.
 *
 * Completions and points (SB-26) reference the instance; stage progress is
 * `chore_stage_progress`.
 */
export const choreInstances = pgTable(
	'chore_instances',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		choreId: uuid('chore_id').notNull(),
		/**
		 * First local date of the period: the day for `daily` and `weekends`, the
		 * Monday for `weekly`.
		 */
		periodStart: date('period_start').notNull(),
		/**
		 * Who's doing the chore this period. For rotation chores this is the
		 * turn, fixed when the period starts (SB-25), so changing the rotation
		 * later doesn't rewrite history. For personal chores it's a copy of
		 * `chores.assigned_member_id`.
		 */
		assignedMemberId: uuid('assigned_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		foreignKey({
			name: 'chore_instances_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		// One instance per chore per period.
		unique('chore_instances_chore_id_period_start_key').on(
			t.choreId,
			t.periodStart,
		),
		// Lets chore_stage_progress reference (instance, chore) together.
		unique('chore_instances_id_chore_id_key').on(t.id, t.choreId),
		index('chore_instances_household_id_period_start_idx').on(
			t.householdId,
			t.periodStart,
		),
		index('chore_instances_assigned_member_id_idx').on(t.assignedMemberId),
		pgPolicy('chore_instances_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// Any member can start the current period (rows are created lazily, by
		// whoever opens the chore first). Changing or deleting one is for parents.
		pgPolicy('chore_instances_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdMember(t.householdId)}
				and ${isMemberIdInHousehold(t.householdId, t.assignedMemberId)}`,
		}),
		pgPolicy('chore_instances_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${isMemberIdInHousehold(t.householdId, t.assignedMemberId)}`,
		}),
		pgPolicy('chore_instances_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const choreInstancesRelations = relations(
	choreInstances,
	({ one, many }) => ({
		household: one(households, {
			fields: [choreInstances.householdId],
			references: [households.id],
		}),
		chore: one(chores, {
			fields: [choreInstances.choreId],
			references: [chores.id],
		}),
		assignee: one(householdMembers, {
			fields: [choreInstances.assignedMemberId],
			references: [householdMembers.id],
		}),
		stageProgress: many(choreStageProgress),
	}),
);
