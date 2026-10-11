import { relations, sql } from 'drizzle-orm';
import {
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';
import { householdMembers } from './household-members.table.ts';
import { landingRoute } from './landing-route.ts';
import { backendRole, currentUserId } from './rls.ts';

/**
 * Which profile a signed-in parent last had open on a device (SB-51). A
 * parent signs in once and hands the device to a managed kid; the server, not
 * the client, remembers that the device is acting as that kid.
 *
 * - `device_hash` is the SHA-256 of a random id kept in an httpOnly cookie on
 *   the device. It only names the device; the member id never comes from the
 *   client.
 * - `active_member_id` is the managed kid the device is acting as, or NULL for
 *   the parent's own view. It survives session expiry and restarts, so the
 *   device goes back to the kid after the parent signs in again. If the kid is
 *   deleted the FK sets it NULL, which falls back to the parent's view.
 * - `session_id` is the last Neon Auth session seen on the device. It's a
 *   fallback key: if someone clears only the device cookie, the row is found
 *   again through the session.
 *
 * - `landing_route` is where signing in on this device opens (SB-57), or NULL
 *   to fall back to the user's `user_preferences.default_landing_route`, then
 *   to Today. It is a per-device setting, so a laptop can open the dashboard
 *   while a shared tablet opens Today.
 *
 * The server re-checks on every request that the user is a parent in the same
 * household as `active_member_id` before trusting it.
 */
export const deviceProfiles = pgTable(
	'device_profiles',
	{
		deviceHash: text('device_hash').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		activeMemberId: uuid('active_member_id').references(
			() => householdMembers.id,
			{ onDelete: 'set null' },
		),
		sessionId: text('session_id'),
		landingRoute: landingRoute('landing_route'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.deviceHash, t.userId] }),
		index('device_profiles_user_id_session_id_idx').on(t.userId, t.sessionId),
		pgPolicy('device_profiles_select', {
			for: 'select',
			to: backendRole,
			using: sql`${t.userId} = ${currentUserId}`,
		}),
		pgPolicy('device_profiles_insert', {
			for: 'insert',
			to: backendRole,
			withCheck: sql`${t.userId} = ${currentUserId}`,
		}),
		pgPolicy('device_profiles_update', {
			for: 'update',
			to: backendRole,
			using: sql`${t.userId} = ${currentUserId}`,
			withCheck: sql`${t.userId} = ${currentUserId}`,
		}),
		pgPolicy('device_profiles_delete', {
			for: 'delete',
			to: backendRole,
			using: sql`${t.userId} = ${currentUserId}`,
		}),
	],
);

export const deviceProfilesRelations = relations(deviceProfiles, ({ one }) => ({
	user: one(user, {
		fields: [deviceProfiles.userId],
		references: [user.id],
	}),
	activeMember: one(householdMembers, {
		fields: [deviceProfiles.activeMemberId],
		references: [householdMembers.id],
	}),
}));
