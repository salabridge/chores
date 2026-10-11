import { redirect } from '@sveltejs/kit';
import { getSetupStatus } from '#lib/server/profiles.js';
import { loadSetupData } from '#lib/server/setup.js';
import { currentStep } from '#lib/setup.js';
import type { PageServerLoad } from './$types';

// First-run setup (SB-56). `hooks.server.ts` already keeps people who don't
// need setup out of here; this checks again so the load never reads a
// finished household's data. Everything shown comes from what the earlier
// steps saved, so reloading resumes at the first unfinished step.
export const load: PageServerLoad = async ({ locals }) => {
	const status = await getSetupStatus();
	if (!status?.needsSetup) redirect(303, '/today');

	const data = await loadSetupData(status);
	return {
		step: currentStep(data.progress),
		progress: data.progress,
		household: data.household,
		parent: data.parent,
		kids: data.kids,
		userName: locals.user?.name ?? '',
	};
};
