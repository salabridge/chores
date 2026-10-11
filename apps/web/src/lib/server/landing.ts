import { userPreferences } from '@chore/db';
import { eq } from 'drizzle-orm';
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
	const deviceRoute = await getDeviceLandingRoute();
	const userDefault =
		user && !deviceRoute ? await loadUserDefault(user.id) : null;
	return effectiveLandingRoute(deviceRoute, userDefault);
}

/**
 * The path to open after sign-in, or on `/`, when no explicit redirect was
 * asked for. Setup comes first, then kid profiles and non-parents get Today,
 * then the device's choice, then the user's default.
 */
export async function getLandingPath(): Promise<string> {
	const { user } = getRequestEvent().locals;
	const [state, setup, deviceRoute] = await Promise.all([
		getProfileState(),
		getSetupStatus(),
		getDeviceLandingRoute(),
	]);
	const mode = state?.mode ?? null;
	// Only a parent in their own view can use the preference, so skip the
	// lookup for everyone else.
	const userDefault =
		user && mode === 'self' && !deviceRoute
			? await loadUserDefault(user.id)
			: null;
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
	await setDeviceLandingRoute(route);
	await db
		.insert(userPreferences)
		.values({ userId, defaultLandingRoute: route })
		.onConflictDoNothing();
	// A row can exist without a default if it was created for another setting.
	const current = await loadUserDefault(userId);
	if (current === null) {
		await db
			.update(userPreferences)
			.set({ defaultLandingRoute: route })
			.where(eq(userPreferences.userId, userId));
	}
}
