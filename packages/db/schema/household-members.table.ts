import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	pgPolicy,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { householdRole } from './household-role.ts';
import { households } from './households.table.ts';
import {
	backendRole,
	currentUserId,
	isHouseholdMember,
	isHouseholdOwner,
	isHouseholdParent,
} from './rls.ts';

/**
 * A person in a household. A member has their own identity (`id`), so kids
 * can exist without an auth account:
 *
 * - Managed kids have `user_id` NULL: a parent created the profile, and a
 *   parent signs in and acts on their behalf (see `app.can_act_as_member`).
 * - Everyone else has a `user_id` pointing at their Neon Auth user, at most
 *   once per household.
 *
 * Other tables reference members by `household_members.id`, never by the auth
 * user id, so a managed kid can later be converted to an invited account by
 * setting `user_id` on their existing row and keep their points and history
 * (not built yet).
 */
export const householdMembers = pgTable(
	'household_members',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		householdId: uuid('household_id')
			.notNull()
			.references(() => households.id, { onDelete: 'cascade' }),
		userId: uuid('user_id').references(() => user.id, { onDelete: 'cascade' }),
		role: householdRole('role').notNull().default('kid'),
		/** What the household calls this person ("Mom", "Leo"). Separate from the auth user's name. */
		displayName: text('display_name').notNull(),
		/** Avatar color, as a design-token key or hex value. NULL lets the UI pick one. */
		avatarColor: text('avatar_color'),
		/** Override for the avatar's initial(s). NULL means the UI uses the display name. */
		avatarInitial: text('avatar_initial'),
		/** Optional, so the UI can show an age ("Mia (7)"). */
		birthYear: smallint('birth_year'),
		/**
		 * Points this member is aiming for each week ("160 / 200 Points
		 * reached"). Set by a parent; the progress is the week's sum from
		 * `points_ledger` (`weeklyPointsProgress()` in ../src/completions.ts).
		 */
		weeklyGoalPoints: integer('weekly_goal_points').notNull().default(200),
		/**
		 * The newest bonus-point gift this member has dismissed the "You got
		 * bonus points!" moment for (SB-83). Gifts after it are unseen; NULL
		 * means none seen yet. Only `app.mark_gifts_seen` changes it, for the
		 * member's own login.
		 */
		giftsSeenAt: timestamp('gifts_seen_at', { withTimezone: true }),
		joinedAt: timestamp('joined_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		/**
		 * When a parent removed this member from the household (SB-84). The row
		 * stays so history (completions, "Done by", the points ledger) keeps
		 * pointing at it, but a removed member is out of every member list,
		 * rotation, picker and stat, and the RLS helpers ignore it. Removal also
		 * clears `user_id`, so the login is detached: the user is in no household
		 * and lands in setup. Set only by `app.remove_household_member`; there's
		 * no restoring yet.
		 */
		removedAt: timestamp('removed_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		// One member row per auth user per household; any number of managed kids.
		uniqueIndex('household_members_household_id_user_id_key')
			.on(t.householdId, t.userId)
			.where(sql`${t.userId} is not null`),
		index('household_members_user_id_idx').on(t.userId),
		// Lets chore_rotation_members reference (member, household) together, so
		// a rotation can only include members of its own household.
		unique('household_members_id_household_id_key').on(t.id, t.householdId),
		check(
			'household_members_display_name_check',
			sql`char_length(btrim(${t.displayName})) between 1 and 50`,
		),
		check(
			'household_members_avatar_color_check',
			sql`${t.avatarColor} is null or char_length(${t.avatarColor}) between 1 and 32`,
		),
		check(
			'household_members_avatar_initial_check',
			sql`${t.avatarInitial} is null or char_length(${t.avatarInitial}) between 1 and 2`,
		),
		check(
			'household_members_weekly_goal_points_check',
			sql`${t.weeklyGoalPoints} >= 0`,
		),
		check(
			'household_members_birth_year_check',
			sql`${t.birthYear} is null or ${t.birthYear} between 1900 and 2200`,
		),
		// Only signed-in users can be parents: a parent has to be able to sign
		// in to act for managed kids. A removed parent keeps their role for
		// history but has no login any more.
		check(
			'household_members_managed_is_kid_check',
			sql`${t.userId} is not null or ${t.role} = 'kid' or ${t.removedAt} is not null`,
		),
		// A removed member has no login (SB-84), so nothing that resolves the
		// signed-in user to a member row can ever find a removed one.
		check(
			'household_members_removed_detached_check',
			sql`${t.removedAt} is null or ${t.userId} is null`,
		),
		pgPolicy('household_members_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdMember(t.householdId),
		}),
		// Owners add anyone. Parents add managed kids (no login). Signed-in kids
		// and parents join through an invite (app.accept_household_invite).
		pgPolicy('household_members_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${isHouseholdOwner(t.householdId)}
				or (${isHouseholdParent(t.householdId)} and ${t.role} = 'kid' and ${t.userId} is null)`,
		}),
		// Owners change anyone. Parents change kids (who stay kids) and their own
		// profile (without promoting themselves). Removed members can't be
		// changed (SB-84). Which columns can change at all
		// is limited by column grants (see the custom migrations): never `id`,
		// `household_id`, or `user_id`.
		pgPolicy('household_members_update', {
			for: 'update',
			to: backendRole,
			using: sql`${t.removedAt} is null and (${isHouseholdOwner(t.householdId)}
				or (${isHouseholdParent(t.householdId)} and (${t.role} = 'kid' or ${t.userId} = ${currentUserId})))`,
			withCheck: sql`${isHouseholdOwner(t.householdId)}
				or (${isHouseholdParent(t.householdId)} and (${t.role} = 'kid' or (${t.userId} = ${currentUserId} and ${t.role} = 'parent')))`,
		}),
		// Owners remove anyone, parents remove kids, and anyone can leave.
		pgPolicy('household_members_delete', {
			for: 'delete',
			to: backendRole,
			using: sql`${isHouseholdOwner(t.householdId)}
				or (${isHouseholdParent(t.householdId)} and ${t.role} = 'kid')
				or ${t.userId} = ${currentUserId}`,
		}),
	],
);

export const householdMembersRelations = relations(
	householdMembers,
	({ one }) => ({
		household: one(households, {
			fields: [householdMembers.householdId],
			references: [households.id],
		}),
		user: one(user, {
			fields: [householdMembers.userId],
			references: [user.id],
		}),
	}),
);
