import { analyticsIdentity } from '#lib/server/profile-state.js';
import { getProfileState } from '#lib/server/profiles.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => ({
	user: locals.user,
	/** Who analytics may know the device as (SB-85). */
	analytics: analyticsIdentity(locals.user ? await getProfileState() : null),
});
