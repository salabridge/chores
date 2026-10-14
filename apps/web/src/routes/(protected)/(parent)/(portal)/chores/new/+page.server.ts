import { error } from '@sveltejs/kit';
import { duplicateInfo, parseKind } from '#lib/chore-duplicate.js';
import { loadDuplicateSource } from '#lib/server/chore-duplicate.js';
import { listHouseholdMembers } from '#lib/server/chores.js';
import { requireParentProfile } from '#lib/server/guards.js';
import type { PageServerLoad } from './$types';

// The layout already sends non-parents away; this load needs the household
// itself and checks again, since layout and page loads run in parallel.
//
// `?from=<choreId>&kind=<personal|rotation>` is "Duplicate as…" (SB-64): the
// creator opens prefilled from that chore. A `from` that isn't an active chore
// of this household (missing, malformed, another household's, or archived) is
// a 404, so a stale or hand-edited link never opens an empty creator that
// looks like it should have had something in it. No `kind`, or an unknown one,
// keeps the source's kind.
export const load: PageServerLoad = async ({ url }) => {
	const { actor } = await requireParentProfile();
	const members = await listHouseholdMembers(actor.householdId);

	const from = url.searchParams.get('from');
	if (from === null) return { members, duplicate: null };

	const source = await loadDuplicateSource(actor.householdId, from);
	if (!source) error(404, 'That chore was not found.');
	return {
		members,
		duplicate: duplicateInfo(source, parseKind(url.searchParams.get('kind'))),
	};
};
