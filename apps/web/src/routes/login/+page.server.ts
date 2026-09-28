import { redirect } from '@sveltejs/kit';
import { safeRedirectTarget } from '#lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const redirectTo = safeRedirectTarget(url.searchParams.get('redirectTo'));
	if (locals.user) redirect(303, redirectTo);
	// Set by `resetPassword` once a new password is saved.
	return { redirectTo, passwordReset: url.searchParams.has('reset') };
};
