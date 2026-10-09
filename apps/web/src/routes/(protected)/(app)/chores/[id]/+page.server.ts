import { error } from '@sveltejs/kit';
import { requireProfile } from '#lib/server/guards.js';
import { loadRotationDetail } from '#lib/server/rotation-detail.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { member } = await requireProfile();
	const detail = await loadRotationDetail(member, params.id);
	if (detail === undefined) error(404, 'Chore not found');
	// Null means a personal chore, which has its own screen.
	return { rotation: detail };
};
