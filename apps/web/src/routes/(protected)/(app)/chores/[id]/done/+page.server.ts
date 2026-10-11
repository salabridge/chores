import { error, redirect } from '@sveltejs/kit';
import { loadCompletionSummary } from '#lib/server/completion-summary.js';
import { requireProfile } from '#lib/server/guards.js';
import type { PageServerLoad } from './$types';

// The celebration screen (SB-42) only ever reads. The points were awarded when
// the chore was completed (SB-26), and this load looks that completion up from
// the `completion` query param, so a refresh, the back button or a shared link
// can never award anything twice.
export const load: PageServerLoad = async ({ params, url }) => {
	const { member } = await requireProfile();
	const completionId = url.searchParams.get('completion') ?? '';
	const summary = await loadCompletionSummary(member, params.id, completionId);
	if (summary === undefined) error(404, 'Completion not found');
	// A parent reopened it, so there is nothing left to celebrate.
	if (summary === null) redirect(303, `/chores/${params.id}`);
	// Full-bleed screen: opt out of the bottom tab nav.
	return { summary, hideNav: true };
};
