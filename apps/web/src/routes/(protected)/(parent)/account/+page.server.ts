import { getEffectiveLandingRoute } from '#lib/server/landing.js';
import type { PageServerLoad } from './$types';

// Parents only (the `(parent)` group guard in hooks.server.ts).
export const load: PageServerLoad = async () => ({
	landingRoute: await getEffectiveLandingRoute(),
});
