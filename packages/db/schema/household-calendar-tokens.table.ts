import { relations, sql } from 'drizzle-orm';
import {
	check,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { households } from './households.table.ts';
import { backendRole, isHouseholdParent } from './rls.ts';

/**
 * The secret behind a household's calendar subscription link (SB-101).
 *
 * Google Calendar, Thunderbird and the like fetch the `.ics` feed without a
 * login, so the link itself is the credential: `/calendar/<token>.ics`. The
 * feed route looks the token up with the owner connection (no session, no
 * RLS). Parents read and regenerate it through RLS.
 *
 * It lives in its own table rather than on `households` because every member
 * can read their household row, kids included. Only parents can see this one.
 *
 * Kept as the token itself, not a hash, because a parent has to be able to
 * copy the link again later. One row per household; regenerating replaces
 * `token`, which stops the old link working.
 */
export const householdCalendarTokens = pgTable(
	'household_calendar_tokens',
	{
		householdId: uuid('household_id')
			.primaryKey()
			.references(() => households.id, { onDelete: 'cascade' }),
		/** 32 random bytes, base64url (`createCalendarToken()` in ../src/calendar-token.ts). */
		token: text('token').notNull().unique(),
		/** The signed-in account that last generated the token (a parent). */
		createdBy: uuid('created_by')
			.default(sql`app.current_user_id()`)
			.references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		/** When the token was last regenerated; NULL if it never was. */
		rotatedAt: timestamp('rotated_at', { withTimezone: true }),
	},
	(t) => [
		check(
			'household_calendar_tokens_token_check',
			sql`char_length(${t.token}) between 32 and 64`,
		),
		pgPolicy('household_calendar_tokens_select', {
			for: 'select',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
		}),
		pgPolicy('household_calendar_tokens_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: isHouseholdParent(t.householdId),
		}),
		pgPolicy('household_calendar_tokens_update', {
			for: 'update',
			to: backendRole,
			using: isHouseholdParent(t.householdId),
			withCheck: isHouseholdParent(t.householdId),
		}),
	],
);

export const householdCalendarTokensRelations = relations(
	householdCalendarTokens,
	({ one }) => ({
		household: one(households, {
			fields: [householdCalendarTokens.householdId],
			references: [households.id],
		}),
	}),
);
