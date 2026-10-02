import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	foreignKey,
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';
import { choreRotations } from './chore-rotations.table.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdMember, isHouseholdParent } from './rls.ts';

/**
 * A member's place in a rotation chore's loop (SB-25): their `position` in
 * the turn order and whether they're `eligible`. An excluded member stays in
 * the list (the UI shows them greyed out) with an `exclusion_reason`, and the
 * turn skips them.
 *
 * `household_id` is copied from the rotation and tied to both the rotation
 * and the member by composite FKs, so a member from another household can't
 * be added, and the policies are plain household checks.
 *
 * Triggers (custom migration 0009) keep the turn valid: excluding or removing
 * the member whose turn it is moves the turn to the next eligible member right
 * away.
 */
export const choreRotationMembers = pgTable(
	'chore_rotation_members',
	{
		choreId: uuid('chore_id').notNull(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		memberId: uuid('member_id').notNull(),
		/**
		 * Turn order, from 1. Unique per chore (deferred, so a reorder can swap
		 * positions in one transaction); gaps are fine.
		 */
		position: smallint('position').notNull(),
		eligible: boolean('eligible').notNull().default(true),
		/**
		 * Why an ineligible member is skipped ("Too young for hot-water
		 * handling"). Required when excluded, NULL when eligible.
		 */
		exclusionReason: text('exclusion_reason'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		primaryKey({
			name: 'chore_rotation_members_pkey',
			columns: [t.choreId, t.memberId],
		}),
		foreignKey({
			name: 'chore_rotation_members_rotation_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [choreRotations.choreId, choreRotations.householdId],
		}).onDelete('cascade'),
		// Leaving the household takes the member out of every rotation.
		foreignKey({
			name: 'chore_rotation_members_member_fk',
			columns: [t.memberId, t.householdId],
			foreignColumns: [householdMembers.id, householdMembers.householdId],
		}).onDelete('cascade'),
		// Hand-edited in the migration to DEFERRABLE INITIALLY DEFERRED.
		unique('chore_rotation_members_chore_id_position_key').on(
			t.choreId,
			t.position,
		),
		index('chore_rotation_members_member_id_idx').on(t.memberId),
		index('chore_rotation_members_household_id_idx').on(t.householdId),
		check('chore_rotation_members_position_check', sql`${t.position} >= 1`),
		check(
			'chore_rotation_members_exclusion_reason_check',
			sql`(${t.eligible} and ${t.exclusionReason} is null)
				or (not ${t.eligible} and char_length(btrim(${t.exclusionReason})) between 1 and 200)`,
		),
		// Members read, parents write (who's in the loop is a parent decision).
		pgPolicy('chore_rotation_members_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('chore_rotation_members_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('chore_rotation_members_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('chore_rotation_members_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const choreRotationMembersRelations = relations(
	choreRotationMembers,
	({ one }) => ({
		household: one(households, {
			fields: [choreRotationMembers.householdId],
			references: [households.id],
		}),
		rotation: one(choreRotations, {
			fields: [choreRotationMembers.choreId],
			references: [choreRotations.choreId],
		}),
		member: one(householdMembers, {
			fields: [choreRotationMembers.memberId],
			references: [householdMembers.id],
		}),
	}),
);
