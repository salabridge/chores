import { milestoneProgress } from '@chore/db/rewards';
import { requireParentProfile } from '#lib/server/guards.js';
import { householdWeekProgress, listRewards } from '#lib/server/rewards.js';
import type { PageServerLoad } from './$types';

// The layout already sends non-parents away; this load needs the household
// itself and checks again, since layout and page loads run in parallel.
export const load: PageServerLoad = async () => {
	const { actor } = await requireParentProfile();
	const [rewards, week] = await Promise.all([
		listRewards(actor.householdId),
		householdWeekProgress(actor.householdId),
	]);
	return {
		rewards,
		week,
		milestones: milestoneProgress(
			rewards.filter((r) => r.kind === 'family_milestone'),
			week.points,
		),
	};
};
