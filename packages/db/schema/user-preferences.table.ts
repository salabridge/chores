import { relations, sql } from 'drizzle-orm';
import { pgPolicy, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { landingRoute } from './landing-route.ts';
import { backendRole, currentUserId } from './rls.ts';

/**
 * Settings that follow a person across devices (SB-57). One row per user.
 *
 * - `default_landing_route` is the fallback for a device that has no
 *   `device_profiles.landing_route` of its own. The first device that picks a
 *   landing screen copies it here; later devices don't overwrite it.
 *
 * Only the user can read or change their own row.
 */
export const userPreferences = pgTable(
	'user_preferences',
	{
		userId: uuid('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		defaultLandingRoute: landingRoute('default_landing_route'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		pgPolicy('user_preferences_select', {
			for: 'select',
			to: backendRole,
			using: sql`${t.userId} = ${currentUserId}`,
		}),
		pgPolicy('user_preferences_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${t.userId} = ${currentUserId}`,
		}),
		pgPolicy('user_preferences_update', {
			for: 'update',
			to: backendRole,
			using: sql`${t.userId} = ${currentUserId}`,
			withCheck: sql`${t.userId} = ${currentUserId}`,
		}),
		pgPolicy('user_preferences_delete', {
			for: 'delete',
			to: backendRole,
			using: sql`${t.userId} = ${currentUserId}`,
		}),
	],
);

export const userPreferencesRelations = relations(
	userPreferences,
	({ one }) => ({
		user: one(user, {
			fields: [userPreferences.userId],
			references: [user.id],
		}),
	}),
);
