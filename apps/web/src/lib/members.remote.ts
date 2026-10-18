import { invalid } from '@sveltejs/kit';
import { requireParentProfile } from '#lib/server/guards.js';
import {
	createInvite,
	resendInvite,
	revokeInvite,
} from '#lib/server/invites.js';
import { addManagedKid, MemberError } from '#lib/server/members.js';
import { resetProfileCache } from '#lib/server/profiles.js';
import { form, getRequestEvent } from '$app/server';
import { inviteLink, parseInviteInput } from './invites.ts';
import { isUuid } from './rewards.ts';
import { parseKidInput } from './setup.ts';

// Remote functions for the parent portal's Members screen (SB-66). Each one
// is parent-only and takes the household from the caller's own profile,
// never from the request.

/** Runs a write, turning a `MemberError` into a form message. */
async function write<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof MemberError) invalid(e.message);
		throw e;
	}
}

const linkFor = (token: string) =>
	inviteLink(getRequestEvent().url.origin, token);

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
		await write(() => addManagedKid(actor.householdId, parsed.value));
		resetProfileCache();
		return { saved: true };
	},
);

/**
 * Invites a parent (owner only) or a kid 13 or older by email. Returns the
 * link, which can only be shown now: just its hash is stored.
 */
export const inviteMember = form(
	'unchecked',
	async (data: {
		role: string;
		email: string;
		displayName?: string;
		birthYear?: string;
	}) => {
		const { actor } = await requireParentProfile();
		const parsed = parseInviteInput(data);
		if (!parsed.ok) invalid(parsed.message);
		const token = await write(() => createInvite(actor, parsed.value));
		return { email: parsed.value.email, link: linkFor(token) };
	},
);

/** Revokes a pending invite. */
export const revokeMemberInvite = form(
	'unchecked',
	async (data: { id: string }) => {
		const { actor } = await requireParentProfile();
		if (!isUuid(data.id)) invalid('That invite was not found.');
		await write(() => revokeInvite(actor, data.id));
		return { revoked: true };
	},
);

/** Gives a pending invite a new link (the old one stops working). */
export const resendMemberInvite = form(
	'unchecked',
	async (data: { id: string }) => {
		const { actor } = await requireParentProfile();
		if (!isUuid(data.id)) invalid('That invite was not found.');
		const token = await write(() => resendInvite(actor, data.id));
		return { id: data.id, link: linkFor(token) };
	},
);
