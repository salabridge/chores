import { invalid, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth.js';
import { requireNotKidProfile } from '#lib/server/guards.js';
import {
	acceptInvite,
	InviteAcceptError,
	isInviteToken,
	leaveHousehold,
	loadCurrentHousehold,
	mergeHouseholdViaInvite,
} from '#lib/server/invite-accept.js';
import { getLandingPath } from '#lib/server/landing.js';
import { resetProfileCache } from '#lib/server/profiles.js';
import { form } from '$app/server';
import { confirmsHouseholdName, PROBLEM_MESSAGES } from './invite-accept.ts';

// Accepting a household invite from its link (SB-66). The user comes from the
// session, never the request; the token is checked by the database function.

/** Runs an accept, turning a refusal into a form message. */
async function accepting(run: () => Promise<unknown>) {
	try {
		await run();
	} catch (e) {
		if (e instanceof InviteAcceptError) invalid(PROBLEM_MESSAGES[e.problem]);
		throw e;
	}
}

/** Joins the household, then goes to the new member's landing screen. */
export const acceptInviteLink = form(
	'unchecked',
	async (data: { token: string }) => {
		const user = requireUser();
		await accepting(() => acceptInvite(user.id, String(data.token ?? '')));
		resetProfileCache();
		redirect(303, await getLandingPath());
	},
);

/**
 * Moves the user's own household into the invite's (SB-76), then goes to
 * their landing screen there. They must have typed the household's name; the
 * database checks they own it. Not from a kid profile: a kid holding the
 * device mustn't be able to give the household up.
 */
export const mergeHouseholdLink = form(
	'unchecked',
	async (data: { token: string; householdId: string; confirmName: string }) => {
		const user = requireUser();
		await requireNotKidProfile();
		const current = await loadCurrentHousehold(user.id);
		if (!current || current.id !== data.householdId) {
			invalid(PROBLEM_MESSAGES['not-owner']);
		}
		if (!confirmsHouseholdName(data.confirmName, current.name)) {
			invalid(`Type ${current.name} to confirm.`);
		}
		await accepting(() =>
			mergeHouseholdViaInvite(user.id, String(data.token ?? ''), current.id),
		);
		resetProfileCache();
		redirect(303, await getLandingPath());
	},
);

/**
 * Leaves the user's household (SB-76), then comes back to the invite so they
 * can accept it. Not from a kid profile, and not for the household's only
 * owner.
 */
export const leaveHouseholdLink = form(
	'unchecked',
	async (data: { token: string; householdId: string }) => {
		const user = requireUser();
		await requireNotKidProfile();
		if (!(await leaveHousehold(user.id, String(data.householdId ?? '')))) {
			invalid(
				"You couldn't leave that household. If you're its only owner, move it instead.",
			);
		}
		resetProfileCache();
		redirect(303, isInviteToken(data.token) ? `/invite/${data.token}` : '/');
	},
);
