import { error } from '@sveltejs/kit';
import { requireProfile } from '#lib/server/guards.js';
import { loadPersonalDetail } from '#lib/server/personal-detail.js';
import { loadRotationDetail } from '#lib/server/rotation-detail.js';
import type { PageServerLoad } from './$types';

// One route, two screens: a rotation chore shows the shared loop (SB-41), a
// personal chore shows its own checklist (SB-40). Completing a personal chore
// goes through a remote form (`personal-detail.remote.ts`), which also works
// without JavaScript.
export const load: PageServerLoad = async ({ params }) => {
	const { member } = await requireProfile();
	const rotation = await loadRotationDetail(member, params.id);
	if (rotation === undefined) error(404, 'Chore not found');
	if (rotation) return { rotation, personal: null };
	const personal = await loadPersonalDetail(member, params.id);
	if (!personal) error(404, 'Chore not found');
	return { rotation: null, personal };
};
