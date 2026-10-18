import { invalid } from '@sveltejs/kit';
import { requireParentProfile } from '#lib/server/guards.js';
import { addManagedKid, MemberError } from '#lib/server/members.js';
import { resetProfileCache } from '#lib/server/profiles.js';
import { form } from '$app/server';
import { parseKidInput } from './setup.ts';

// Remote functions for the parent portal's Members screen (SB-66). Each one
// is parent-only and takes the household from the caller's own profile,
// never from the request.

/** Adds a managed kid (no login) after setup. */
export const addManagedKidMember = form(
	'unchecked',
	async (data: {
		displayName: string;
		birthYear?: string;
		avatarColor: string;
		weeklyGoalPoints?: string;
	}) => {
		const { actor } = await requireParentProfile();
		const parsed = parseKidInput(data);
		if (!parsed.ok) invalid(parsed.message);
		try {
			await addManagedKid(actor.householdId, parsed.value);
		} catch (e) {
			if (e instanceof MemberError) invalid(e.message);
			throw e;
		}
		resetProfileCache();
		return { saved: true };
	},
);
