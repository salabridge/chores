import { relations, sql } from 'drizzle-orm';
import {
	check,
	foreignKey,
	index,
	type PgTableExtraConfigValue,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';
import { choreRotationMembers } from './chore-rotation-members.table.ts';
import { chores } from './chores.table.ts';
import { householdMembers } from './household-members.table.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdMember, isHouseholdParent } from './rls.ts';
import { rotationScope } from './rotation-scope.ts';

/**
 * The turn-taking loop of a rotation chore (`chores.type = 'rotation'`), one
 * row per chore. Who's in the loop, in what order, and who's excluded is
 * `chore_rotation_members`.
 *
 * `current_member_id` is the Active Turn. After a completion it moves to the
 * next eligible member by position, wrapping to the first ("Loop Reset").
 * Move it with `app.advance_chore_rotation` (`advanceRotation()` in
 * ../src/rotations.ts), which kids can call for their own turn; the table
 * itself is parent-only.
 *
 * Rules the database enforces (custom migration 0009, checked at commit so a
 * parent can save the rotation and its members in one transaction):
 *
 * - at least 2 eligible members;
 * - the current turn is one of the eligible members;
 * - the chore is a rotation chore.
 *
 * Removing someone from the household never fails on these rules; it can
 * leave a loop with fewer than 2 eligible members, which the UI should flag
 * (`getRotationTurns().eligibleCount`).
 */
export const choreRotations = pgTable(
	'chore_rotations',
	{
		choreId: uuid('chore_id').primaryKey(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		scope: rotationScope('scope').notNull().default('whole_household'),
		/** Optional label for the loop ("Kids only", "Older helpers only"). */
		scopeLabel: text('scope_label'),
		/**
		 * Active Turn: a `household_members.id` that's an eligible member of this
		 * rotation. References `chore_rotation_members (chore_id, member_id)`
		 * (deferred, so the rotation row can be inserted before its members).
		 * NULL only while a rotation has no eligible members left.
		 */
		currentMemberId: uuid('current_member_id'),
		/** When the current turn began (the last advance, or creation). */
		turnStartedAt: timestamp('turn_started_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		/**
		 * Done Last: the member whose completion last advanced the turn. A skip
		 * advances without changing it.
		 */
		lastCompletedMemberId: uuid('last_completed_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		lastCompletedAt: timestamp('last_completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	// Annotated because this table and chore_rotation_members reference each
	// other, which TypeScript can't infer through.
	(t): PgTableExtraConfigValue[] => [
		foreignKey({
			name: 'chore_rotations_chore_fk',
			columns: [t.choreId, t.householdId],
			foreignColumns: [chores.id, chores.householdId],
		}).onDelete('cascade'),
		// Hand-edited in the migration to DEFERRABLE INITIALLY DEFERRED: the
		// members it points at are inserted after the rotation row.
		foreignKey({
			name: 'chore_rotations_current_member_fk',
			columns: [t.choreId, t.currentMemberId],
			foreignColumns: [
				choreRotationMembers.choreId,
				choreRotationMembers.memberId,
			],
		}),
		// Lets chore_rotation_members reference (chore, household) together.
		unique('chore_rotations_chore_id_household_id_key').on(
			t.choreId,
			t.householdId,
		),
		index('chore_rotations_household_id_idx').on(t.householdId),
		check(
			'chore_rotations_scope_label_check',
			sql`${t.scopeLabel} is null or char_length(btrim(${t.scopeLabel})) between 1 and 40`,
		),
		// Same as chores: members read, parents write. Advancing the turn goes
		// through app.advance_chore_rotation, which checks its own rules.
		pgPolicy('chore_rotations_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		pgPolicy('chore_rotations_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('chore_rotations_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('chore_rotations_delete', {
			for: 'delete',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
	],
);

export const choreRotationsRelations = relations(
	choreRotations,
	({ one, many }) => ({
		household: one(households, {
			fields: [choreRotations.householdId],
			references: [households.id],
		}),
		chore: one(chores, {
			fields: [choreRotations.choreId],
			references: [chores.id],
		}),
		currentMember: one(householdMembers, {
			fields: [choreRotations.currentMemberId],
			references: [householdMembers.id],
		}),
		lastCompletedMember: one(householdMembers, {
			fields: [choreRotations.lastCompletedMemberId],
			references: [householdMembers.id],
		}),
		members: many(choreRotationMembers),
	}),
);
