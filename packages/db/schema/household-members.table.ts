import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	pgPolicy,
	pgTable,
	smallint,
	text,
	timestamp,
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
		joinedAt: timestamp('joined_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
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
			'household_members_birth_year_check',
			sql`${t.birthYear} is null or ${t.birthYear} between 1900 and 2200`,
		),
		// Only signed-in users can be parents: a parent has to be able to sign
		// in to act for managed kids.
		check(
			'household_members_managed_is_kid_check',
			sql`${t.userId} is not null or ${t.role} = 'kid'`,
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
		// profile (without promoting themselves). Which columns can change at all
		// is limited by column grants (see the custom migrations): never `id`,
		// `household_id`, or `user_id`.
		pgPolicy('household_members_update', {
			for: 'update',
			to: backendRole,
			using: sql`${isHouseholdOwner(t.householdId)}
				or (${isHouseholdParent(t.householdId)} and (${t.role} = 'kid' or ${t.userId} = ${currentUserId}))`,
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
