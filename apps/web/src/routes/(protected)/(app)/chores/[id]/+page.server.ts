import { error } from '@sveltejs/kit';
import { requireProfile } from '#lib/server/guards.js';
import { listHouseholdMembers } from '#lib/server/members.js';
import { loadPersonalDetail } from '#lib/server/personal-detail.js';
import { isParentRole } from '#lib/server/profile-state.js';
import { loadRotationDetail } from '#lib/server/rotation-detail.js';
import type { PageServerLoad } from './$types';

// One route, two screens: a rotation chore shows the shared loop (SB-41), a
// personal chore shows its own checklist (SB-40). Completing a personal chore
// goes through a remote form (`personal-detail.remote.ts`), which also works
// without JavaScript.
export const load: PageServerLoad = async ({ params }) => {
	const state = await requireProfile();
	const { member } = state;
	// A parent's own view, not a kid profile they have opened: the edit and
	// duplicate pages reject anything else, so don't offer either.
	const canEdit = state.mode === 'self' && isParentRole(member.role);
	const rotation = await loadRotationDetail(member, params.id);
	if (rotation === undefined) error(404, 'Chore not found');
	// A parent in their own view can record who did a chore (SB-75), so they
	// get the household to choose from. Everyone else is credited as themselves.
	const doerOptions = canEdit
		? (await listHouseholdMembers(member.householdId)).map((m) => ({
				id: m.id,
				name: m.displayName,
			}))
		: undefined;
	const viewerId = member.id;
	if (rotation) {
		return { rotation, personal: null, canEdit, doerOptions, viewerId };
	}
	const personal = await loadPersonalDetail(member, params.id);
	if (!personal) error(404, 'Chore not found');
	return { rotation: null, personal, canEdit, doerOptions, viewerId };
};
