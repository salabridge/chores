import { relations, sql } from 'drizzle-orm';
import {
	foreignKey,
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { choreInstances } from './chore-instances.table.ts';
import { choreStages } from './chore-stages.table.ts';
import { chores } from './chores.table.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdMember, isHouseholdParent } from './rls.ts';

/**
 * Which stages of a chore are done in a period: a row means stage `stage_id`
 * is done in instance `instance_id`. Unchecking a stage deletes the row. The
 * next period is a new instance with no rows, so stages reset on their own.
 *
 * `chore_id` and `household_id` are carried so composite FKs can guarantee
 * the stage and the instance belong to the same chore, and the chore to the
 * household the policies check.
 *
 * Unlike `chore_stages`, kids write here: checking off a stage is the kid's
 * part of the chore. A member checks off stages as themselves, and a parent
 * can check off for anyone in the household (including managed kids).
 * Points for stages are recorded by SB-26's ledger, not here.
 */
export const choreStageProgress = pgTable(
	'chore_stage_progress',
	{
		instanceId: uuid('instance_id').notNull(),
		stageId: uuid('stage_id').notNull(),
		choreId: uuid('chore_id').notNull(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		/** Who did the stage. NULL only if that member was later removed. */
		completedByMemberId: uuid('completed_by_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		completedAt: timestamp('completed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		primaryKey({
			name: 'chore_stage_progress_pkey',
			columns: [t.instanceId, t.stageId],
		}),
		foreignKey({
			name: 'chore_stage_progress_instance_fk',
			columns: [t.instanceId, t.choreId],
			foreignColumns: [choreInstances.id, choreInstances.choreId],
		}).onDelete('cascade'),
		foreignKey({
			name: 'chore_stage_progress_stage_fk',
			columns: [t.stageId, t.choreId],
			foreignColumns: [choreStages.id, choreStages.choreId],
		}).onDelete('cascade'),
		foreignKey({
			name: 'chore_stage_progress_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		index('chore_stage_progress_stage_id_idx').on(t.stageId),
		index('chore_stage_progress_household_id_idx').on(t.householdId),
		pgPolicy('chore_stage_progress_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('chore_stage_progress_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdMember(t.householdId)}
				and app.is_member_id_in(${t.householdId}, ${t.completedByMemberId})
				and (${isHouseholdParent(t.householdId)} or app.can_act_as_member(${t.completedByMemberId}))`,
		}),
		// No update policy: un-checking is a delete.
		pgPolicy('chore_stage_progress_delete', {
			for: 'delete',
			to: backendRole,
			using: sql`${isHouseholdParent(t.householdId)}
				or app.can_act_as_member(${t.completedByMemberId})`,
		}),
	],
);

export const choreStageProgressRelations = relations(
	choreStageProgress,
	({ one }) => ({
		instance: one(choreInstances, {
			fields: [choreStageProgress.instanceId],
			references: [choreInstances.id],
		}),
		stage: one(choreStages, {
			fields: [choreStageProgress.stageId],
			references: [choreStages.id],
		}),
		completedBy: one(householdMembers, {
			fields: [choreStageProgress.completedByMemberId],
			references: [householdMembers.id],
		}),
	}),
);
