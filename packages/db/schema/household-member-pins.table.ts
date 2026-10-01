import { relations, sql } from 'drizzle-orm';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { householdMembers } from './household-members.table.ts';
import { backendRole, isOwnMember } from './rls.ts';

/**
 * A parent's PIN for the managed-kid profile lock (SB-51 builds the flow): a
 * parent signs in, picks a kid's profile, and switching away needs the PIN.
 *
 * Stored per parent membership, apart from `household_members`, because
 * every member can read that table and a short PIN hash is easy to brute-force
 * offline. Only the parent themselves can read or change their row (so kids,
 * who have their own login or none, never see it).
 *
 * `pin_hash` is a self-describing password hash made by the app (for example
 * an argon2id or scrypt PHC string), never the PIN itself.
 */
export const householdMemberPins = pgTable(
	'household_member_pins',
	{
		memberId: uuid('member_id')
			.primaryKey()
			.references(() => householdMembers.id, { onDelete: 'cascade' }),
		pinHash: text('pin_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		pgPolicy('household_member_pins_select', {
			for: 'select',
			to: backendRole,
			using: isOwnMember(t.memberId),
		}),
		// Only parents (and owners) have a PIN.
		pgPolicy('household_member_pins_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`app.is_own_parent_member(${t.memberId})`,
		}),
		pgPolicy('household_member_pins_update', {
			for: 'update',
			to: backendRole,
			using: isOwnMember(t.memberId),
			withCheck: sql`app.is_own_parent_member(${t.memberId})`,
		}),
		pgPolicy('household_member_pins_delete', {
			for: 'delete',
			to: backendRole,
			using: isOwnMember(t.memberId),
		}),
	],
);

export const householdMemberPinsRelations = relations(
	householdMemberPins,
	({ one }) => ({
		member: one(householdMembers, {
			fields: [householdMemberPins.memberId],
			references: [householdMembers.id],
		}),
	}),
);
