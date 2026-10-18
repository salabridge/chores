import { redirect } from '@sveltejs/kit';
import { getPendingCode, safeRedirectTarget } from '#lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, cookies }) => {
	const redirectTo = safeRedirectTarget(url.searchParams.get('redirectTo'));
	// A signed-in user whose email isn't verified yet (see
	// `sendVerificationCode`) still has a code to enter.
	if (locals.user?.emailVerified) redirect(303, redirectTo);
	const pending = getPendingCode(cookies);
	if (!pending) redirect(303, '/login');
	// A checked password-reset code has nothing left to verify.
	if (pending.otp) redirect(303, '/reset-password');
	return { redirectTo, email: pending.email, purpose: pending.purpose };
};
