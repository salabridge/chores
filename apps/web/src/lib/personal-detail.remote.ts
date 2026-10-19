import { error, invalid, redirect } from '@sveltejs/kit';
import { completionHref } from '#lib/chore-completion.js';
import { requireProfile } from '#lib/server/guards.js';
import {
	completePersonalStep,
	PersonalDetailError,
} from '#lib/server/personal-detail.js';
import { form } from '$app/server';

// Remote form for the personal chore screen (SB-40). It is a real <form>, so
// it works without JavaScript: the browser posts it and follows the redirect.
// The member comes from the caller's own profile, never from the request. The
// chore's assignee completes their own chore; anyone else in the household
// completing it does it for them and gets the points (SB-74). The one thing a
// request can name is `doneBy`, and only a parent in their own view may use it
// (to record that another member did it); the server checks it's someone in
// their household.

/**
 * Checks off one stage (`stageId`), or completes a chore without stages. The
 * last stage, or a single-step chore, awards the points once and sends
 * whoever earned them to the celebration screen. A repeat lands on the same
 * screen without awarding again. A parent who recorded someone else as the
 * doer goes back to the chore instead (the celebration is the doer's).
 */
export const completePersonalChore = form(
	'unchecked',
	async (data: { choreId: string; stageId?: string; doneBy?: string }) => {
		const state = await requireProfile();
		const choreId = String(data.choreId ?? '');
		const doneBy = data.doneBy ? String(data.doneBy) : null;
		let completionId: string | null;
		try {
			({ completionId } = await completePersonalStep(
				state,
				choreId,
				data.stageId ? String(data.stageId) : null,
				{ doneBy },
			));
		} catch (e) {
			if (e instanceof PersonalDetailError) {
				if (e.status === 404) error(404, e.message);
				invalid(e.message);
			}
			throw e;
		}
		if (doneBy && doneBy !== state.member.id) {
			redirect(303, `/chores/${encodeURIComponent(choreId)}`);
		}
		if (completionId) redirect(303, completionHref(choreId, completionId));
	},
);
