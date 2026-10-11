import { invalid } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { saveLandingRoute } from '#lib/server/landing.js';
import { form } from '$app/server';
import { isLandingRoute } from './landing.ts';

/**
 * Saves where signing in opens on this device (SB-57). Parent-only, and only
 * the enum values are accepted: a client can't store a path.
 */
export const saveLanding = form(
	'unchecked',
	async (data: { landingRoute: string }) => {
		const user = requireUser();
		await requireParentProfile();
		if (!isLandingRoute(data.landingRoute))
			invalid('Choose Today or Parent dashboard.');
		await saveLandingRoute(user.id, data.landingRoute);
		return { saved: true };
	},
);
