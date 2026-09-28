import { redirect } from '@sveltejs/kit';
import { getPendingCode } from '#lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, cookies }) => {
	if (locals.user) redirect(303, '/');
	// Only reachable once `verifyCode` has checked a password-reset code.
	const pending = getPendingCode(cookies);
	if (pending?.purpose !== 'forget-password' || !pending.otp) {
		redirect(303, '/forgot-password');
	}
	return { email: pending.email };
};
