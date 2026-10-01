import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	pgPolicy,
	pgTable,
	text,
	time,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { choreFrequency } from './chore-frequency.ts';
import { choreInstances } from './chore-instances.table.ts';
import { choreStages } from './chore-stages.table.ts';
import { choreType } from './chore-type.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdParent,
	isMemberIdInHousehold,
} from './rls.ts';

/**
 * A chore definition: what to do, for how many points, and how often. It
 * doesn't hold per-period state. Each period (day or week, see
 * `chore_frequency`) gets a `chore_instances` row, which is what resets; see
 * "Recurrence" in ../README.md.
 */
export const chores = pgTable(
	'chores',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		/**
		 * Shown in the UI as the "Parent Note": instructions from the parent
		 * ("Use the blue bags"). Kept as `description` rather than renamed.
		 */
		description: text('description'),
		type: choreType('type').notNull().default('personal'),
		/**
		 * Points for finishing the chore. The creator offers 5/10/15/20 as
		 * presets, but any non-negative integer is allowed. Stages can carry
		 * their own points (`chore_stages.points`).
		 */
		points: integer('points').notNull().default(10),
		frequency: choreFrequency('frequency').notNull().default('daily'),
		/**
		 * Optional time of day it's due by, in the household's local time
		 * ("by 8:00 PM" is 20:00). No time zone: the period it applies to is a
		 * local date (`chore_instances.period_start`).
		 */
		dueTime: time('due_time'),
		/**
		 * Optional free-text due label for when there's no clock time ("after
		 * dinner"). The UI shows this if set, otherwise `due_time`.
		 */
		dueLabel: text('due_label'),
		/**
		 * The household member doing the chore (a `household_members.id`, not an
		 * auth user id, so managed kids without a login can be assigned).
		 */
		assignedMemberId: uuid('assigned_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		/** The auth user who created the chore (an audit field, not a member reference). */
		createdBy: uuid('created_by')
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'set null' }),
		/**
		 * Legacy one-off fields from before recurrence. Recurring chores use
		 * `frequency`/`due_time` and per-period `chore_instances`; completion is
		 * recorded by SB-26. Not used by the app; slated for removal.
		 */
		dueAt: timestamp('due_at', { withTimezone: true }),
		/** Legacy; see `dueAt`. */
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		index('chores_household_id_idx').on(t.householdId),
		index('chores_assigned_member_id_idx').on(t.assignedMemberId),
		// Lets chore_stages and chore_instances reference (chore, household)
		// together, so their household_id (used by their RLS) always matches.
		unique('chores_id_household_id_key').on(t.id, t.householdId),
		check('chores_points_check', sql`${t.points} >= 0`),
		check(
			'chores_due_label_check',
			sql`${t.dueLabel} is null or char_length(btrim(${t.dueLabel})) between 1 and 40`,
		),
		pgPolicy('chores_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// Chores are managed by parents. Kids record their part through the
		// completions table (SB-26), not by editing chores. A chore can only be
		// assigned to a member of the same household.
		pgPolicy('chores_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${t.createdBy} = ${currentUserId}
				and ${isMemberIdInHousehold(t.householdId, t.assignedMemberId)}`,
		}),
		pgPolicy('chores_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: sql`${isHouseholdParent(t.householdId)}
				and ${isMemberIdInHousehold(t.householdId, t.assignedMemberId)}`,
		}),
		pgPolicy('chores_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const choresRelations = relations(chores, ({ one, many }) => ({
	household: one(households, {
		fields: [chores.householdId],
		references: [households.id],
	}),
	assignee: one(householdMembers, {
		fields: [chores.assignedMemberId],
		references: [householdMembers.id],
	}),
	creator: one(user, { fields: [chores.createdBy], references: [user.id] }),
	stages: many(choreStages),
	instances: many(choreInstances),
}));
