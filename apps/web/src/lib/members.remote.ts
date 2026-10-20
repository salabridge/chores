import { invalid } from '@sveltejs/kit';
import { GiftError, giftPoints as saveGift } from '#lib/server/gifts.js';
import { requireParentProfile } from '#lib/server/guards.js';
import { sendInvite } from '#lib/server/invite-email.js';
import {
	createInvite,
	householdName,
	resendInvite,
	revokeInvite,
} from '#lib/server/invites.js';
import {
	addManagedKid,
	MemberError,
	removeMember as removeHouseholdMember,
	updateMemberAvatar as saveMemberAvatar,
} from '#lib/server/members.js';
import { resetProfileCache } from '#lib/server/profiles.js';
import { APP_ORIGIN } from '$app/env/private';
import { form, getRequestEvent } from '$app/server';
import { inviteLink, parseInviteInput } from './invites.ts';
import { isUuid } from './rewards.ts';
import { parseAvatarInput, parseKidInput } from './setup.ts';

// Remote functions for the parent portal's Members screen (SB-66). Each one
// is parent-only and takes the household from the caller's own profile,
// never from the request.

/** Runs a write, turning a `MemberError` into a form message. */
async function write<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof MemberError || e instanceof GiftError) invalid(e.message);
		throw e;
	}
}

// An invite link is a credential, so where it's configured its origin comes
// from APP_ORIGIN, not the Host / forwarded-host headers of the request. The
// request's origin is only a fallback where it isn't (local dev, e2e,
// previews), and no invite email is sent there.
const linkFor = (token: string) =>
	inviteLink(APP_ORIGIN ?? getRequestEvent().url.origin, token);

type Actor = Awaited<ReturnType<typeof requireParentProfile>>['actor'];

/** Emails the link; whether it went out is shown next to the copy-link box. */
async function email(
	actor: Actor,
	invite: { email: string; role: 'parent' | 'kid'; link: string },
) {
	const result = await sendInvite({
		to: invite.email,
		role: invite.role,
		link: invite.link,
		inviterName: actor.displayName,
		householdName: await householdName(actor.householdId),
	});
	return result.sent;
}

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
 * Changes a member's avatar colour and initial. Owners can change anyone's, a
 * parent their own and kids'; `updateMemberAvatar` enforces that.
 */
export const updateMemberAvatar = form(
	'unchecked',
	async (data: { id: string; avatarColor: string; avatarInitial?: string }) => {
		const { actor } = await requireParentProfile();
		if (!isUuid(data.id)) invalid('That member was not found.');
		const parsed = parseAvatarInput(data);
		if (!parsed.ok) invalid(parsed.message);
		await write(() => saveMemberAvatar(actor, data.id, parsed.value));
		resetProfileCache();
		return { saved: true, id: data.id };
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
		const link = linkFor(token);
		const emailed = await email(actor, { ...parsed.value, link });
		return { email: parsed.value.email, link, emailed };
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
		const invite = await write(() => resendInvite(actor, data.id));
		const link = linkFor(invite.token);
		const emailed = await email(actor, { ...invite, link });
		return { id: data.id, link, emailed };
	},
);

/**
 * Gives a kid bonus points with a reason (SB-78). `requireParentProfile`
 * rejects non-parents and a parent whose device is on a kid profile;
 * `giftPoints` checks the member is a kid in the actor's household and the
 * amount and reason again.
 */
export const giftPoints = form(
	'unchecked',
	async (data: { memberId: string; points: string; reason: string }) => {
		const { actor } = await requireParentProfile();
		if (!isUuid(data.memberId)) invalid('That member was not found.');
		const gift = await write(() => saveGift(actor, data.memberId, data));
		return { gifted: true, memberId: data.memberId, points: gift.points };
	},
);

/**
 * Removes a member from the household (SB-84), optionally moving a kid's
 * points to another kid (`movePointsTo`, empty for none). `requireParentProfile`
 * rejects non-parents and a parent on a kid profile; the database function
 * checks the rest (only owners remove parents, nobody removes themselves).
 */
export const removeMember = form(
	'unchecked',
	async (data: { memberId: string; movePointsTo?: string }) => {
		const state = await requireParentProfile();
		if (!isUuid(data.memberId)) invalid('That member was not found.');
		const movePointsTo = data.movePointsTo ? data.movePointsTo : null;
		if (movePointsTo !== null && !isUuid(movePointsTo)) {
			invalid('Points can only move to another kid in the household.');
		}
		const removed = await write(() =>
			removeHouseholdMember(state, data.memberId, movePointsTo),
		);
		resetProfileCache();
		return { removed: true, memberId: data.memberId, ...removed };
	},
);
