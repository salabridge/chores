import { redirect } from '@sveltejs/kit';
import { getLandingPath } from '#lib/server/landing.js';
import type { PageServerLoad } from './$types';

// A signed-in user never stays on the landing page: they go to the screen they
// chose for this device (SB-57), or `/setup` / Today. `hooks.server.ts` has
// already sent anyone who needs setup to /setup.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, await getLandingPath());
};
