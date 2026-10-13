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
// The member comes from the caller's own profile, never from the request, and
// only the chore's assignee can complete it.

/**
 * Checks off one stage (`stageId`), or completes a chore without stages. The
 * last stage, or a single-step chore, awards the points once and sends the
 * member to the celebration screen. A repeat lands on the same screen without
 * awarding again.
 */
export const completePersonalChore = form(
	'unchecked',
	async (data: { choreId: string; stageId?: string }) => {
		const state = await requireProfile();
		const choreId = String(data.choreId ?? '');
		let completionId: string | null;
		try {
			({ completionId } = await completePersonalStep(
				state,
				choreId,
				data.stageId ? String(data.stageId) : null,
			));
		} catch (e) {
			if (e instanceof PersonalDetailError) {
				if (e.status === 404) error(404, e.message);
				invalid(e.message);
			}
			throw e;
		}
		if (completionId) redirect(303, completionHref(choreId, completionId));
	},
);
