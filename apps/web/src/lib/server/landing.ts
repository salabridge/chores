import { userPreferences } from '@chore/db';
import { eq, sql } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import {
	effectiveLandingRoute,
	type LandingRoute,
	resolveLandingPath,
} from '../landing.ts';
import { db } from './drizzle.ts';
import {
	getDeviceLandingRoute,
	getProfileState,
	getSetupStatus,
	setDeviceLandingRoute,
} from './profiles.ts';

// Where a signed-in user lands by default (SB-57). Resolved on the server from
// rows it loads itself; the client only ever *requests* one of the enum values.

async function loadUserDefault(userId: string): Promise<LandingRoute | null> {
	const [row] = await db
		.select({ route: userPreferences.defaultLandingRoute })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId));
	return row?.route ?? null;
}

/** The route in effect for this device and user, for showing the current setting. */
export async function getEffectiveLandingRoute(): Promise<LandingRoute> {
	const { user } = getRequestEvent().locals;
	// The default is a primary-key lookup, so it runs alongside the device
	// read rather than after it, even though a device choice makes it moot.
	const [deviceRoute, userDefault] = await Promise.all([
		getDeviceLandingRoute(),
		user ? loadUserDefault(user.id) : null,
	]);
	return effectiveLandingRoute(deviceRoute, userDefault);
}

/**
 * The path to open after sign-in, or on `/`, when no explicit redirect was
 * asked for. Setup comes first, then kid profiles and non-parents get Today,
 * then the device's choice, then the user's default.
 */
export async function getLandingPath(): Promise<string> {
	const { user } = getRequestEvent().locals;
	// The user's default is fetched with the rest rather than after them: it's
	// a primary-key lookup, cheaper than the extra round trip of waiting to see
	// whether it's needed. Only a parent in their own view uses it.
	const [state, setup, deviceRoute, storedDefault] = await Promise.all([
		getProfileState(),
		getSetupStatus(),
		getDeviceLandingRoute(),
		user ? loadUserDefault(user.id) : null,
	]);
	const mode = state?.mode ?? null;
	const userDefault = mode === 'self' ? storedDefault : null;
	return resolveLandingPath({
		needsSetup: setup?.needsSetup ?? false,
		mode,
		role: state?.actor.role ?? null,
		deviceRoute,
		userDefault,
	});
}

/**
 * Saves the landing screen for this device. The first device that sets one
 * also becomes the user's default, so their other devices follow it until they
 * choose differently there (the default is never overwritten afterwards).
 */
export async function saveLandingRoute(userId: string, route: LandingRoute) {
	await Promise.all([
		setDeviceLandingRoute(route),
		// Creates the row, or fills a missing default (the row can exist for
		// another setting); never overwrites one. One statement, so two devices
		// saving at once can't both see no default and both write theirs.
		db
			.insert(userPreferences)
			.values({ userId, defaultLandingRoute: route })
			.onConflictDoUpdate({
				target: userPreferences.userId,
				set: {
					defaultLandingRoute: sql`coalesce(${userPreferences.defaultLandingRoute}, excluded.default_landing_route)`,
				},
			}),
	]);
}
