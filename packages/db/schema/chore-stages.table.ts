import { relations, sql } from 'drizzle-orm';
import {
	check,
	foreignKey,
	index,
	integer,
	pgPolicy,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';
import { chores } from './chores.table.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdMember, isHouseholdParent } from './rls.ts';

/**
 * The ordered steps of a chore ("Stage 2 of 3"). Personal chores use them for
 * routines; rotation chores can have them too. A chore with no stages is done
 * in one step.
 *
 * `household_id` is copied from the chore (a composite FK keeps it in sync)
 * so the policies match `chores` exactly without a subquery. Which stages are
 * done in the current period is `chore_stage_progress`.
 */
export const choreStages = pgTable(
	'chore_stages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		choreId: uuid('chore_id').notNull(),
		/**
		 * Order within the chore, from 1. Unique per chore; gaps are fine, so the
		 * UI numbers stages by their order, not by this value.
		 */
		position: smallint('position').notNull(),
		title: text('title').notNull(),
		/** Optional help text shown under the stage ("Check under the bed"). */
		hint: text('hint'),
		/** Points for finishing this stage, on top of the chore's own points. */
		points: integer('points').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		foreignKey({
			name: 'chore_stages_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		unique('chore_stages_chore_id_position_key').on(t.choreId, t.position),
		// Lets chore_stage_progress reference (stage, chore) together.
		unique('chore_stages_id_chore_id_key').on(t.id, t.choreId),
		index('chore_stages_household_id_idx').on(t.householdId),
		check('chore_stages_position_check', sql`${t.position} >= 1`),
		check(
			'chore_stages_title_check',
			sql`char_length(btrim(${t.title})) between 1 and 100`,
		),
		check(
			'chore_stages_hint_check',
			sql`${t.hint} is null or char_length(${t.hint}) <= 500`,
		),
		check('chore_stages_points_check', sql`${t.points} >= 0`),
		// Same as chores: members read, parents write.
		pgPolicy('chore_stages_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('chore_stages_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('chore_stages_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('chore_stages_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const choreStagesRelations = relations(choreStages, ({ one }) => ({
	household: one(households, {
		fields: [choreStages.householdId],
		references: [households.id],
	}),
	chore: one(chores, {
		fields: [choreStages.choreId],
		references: [chores.id],
	}),
}));
