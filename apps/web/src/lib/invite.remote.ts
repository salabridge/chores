import { invalid, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { acceptInvite, InviteAcceptError } from '#lib/server/invite-accept.js';
import { getLandingPath } from '#lib/server/landing.js';
import { resetProfileCache } from '#lib/server/profiles.js';
import { form } from '$app/server';
import { PROBLEM_MESSAGES } from './invite-accept.ts';

// Accepting a household invite from its link (SB-66). The user comes from the
// session, never the request; the token is checked by the database function.

/** Joins the household, then goes to the new member's landing screen. */
export const acceptInviteLink = form(
	'unchecked',
	async (data: { token: string }) => {
		const user = requireUser();
		try {
			await acceptInvite(user.id, String(data.token ?? ''));
		} catch (e) {
			if (e instanceof InviteAcceptError) invalid(PROBLEM_MESSAGES[e.problem]);
			throw e;
		}
		resetProfileCache();
		redirect(303, await getLandingPath());
	},
);
