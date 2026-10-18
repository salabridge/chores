import { MAX_DISPLAY_NAME, MIN_BIRTH_YEAR } from './setup.ts';

// Household invites (SB-66): a parent or kid with their own login joins
// through an emailed link. Shared by the Members screen and its remote
// functions.

export type InviteRole = 'parent' | 'kid';

/** Matches `household_invites_email_check`, plus the usual length limit. */
const EMAIL = /^[^@\s]+@[^@\s]+$/;
const MAX_EMAIL = 254;

/**
 * The latest birth year an invited kid can have. We only store a year, so we
 * can't tell whether someone born `currentYear - 13` has had their 13th
 * birthday yet; requiring a year earlier guarantees they have (COPPA).
 */
export const latestInviteBirthYear = (currentYear: number) => currentYear - 14;

export const UNDER_13_MESSAGE =
	"Kids under 13 can't have their own login. Add them as a managed kid instead.";

export interface InviteInput {
	role: InviteRole;
	email: string;
	/** Name for the new member row; null uses the name they sign up with. */
	displayName: string | null;
	/** Required for kids, null for parents. */
	birthYear: number | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({
	ok: false,
	message,
});

export function parseInviteInput(
	data: {
		role?: unknown;
		email?: unknown;
		displayName?: unknown;
		birthYear?: unknown;
	},
	currentYear = new Date().getFullYear(),
): Parsed<InviteInput> {
	const role = data.role;
	if (role !== 'parent' && role !== 'kid') {
		return fail('Choose who you are inviting.');
	}

	const email = String(data.email ?? '').trim();
	if (email.length === 0) return fail('Enter their email address.');
	if (email.length > MAX_EMAIL || !EMAIL.test(email)) {
		return fail('Enter a valid email address.');
	}

	const name = String(data.displayName ?? '').trim();
	if (name.length > MAX_DISPLAY_NAME) {
		return fail(`Keep the name to ${MAX_DISPLAY_NAME} characters.`);
	}

	let birthYear: number | null = null;
	if (role === 'kid') {
		const rawYear = String(data.birthYear ?? '').trim();
		if (rawYear === '') return fail("Enter your kid's birth year.");
		birthYear = Number(rawYear);
		if (
			!Number.isInteger(birthYear) ||
			birthYear < MIN_BIRTH_YEAR ||
			birthYear > currentYear
		) {
			return fail(
				`Enter a birth year between ${MIN_BIRTH_YEAR} and ${currentYear}.`,
			);
		}
		if (birthYear > latestInviteBirthYear(currentYear)) {
			return fail(UNDER_13_MESSAGE);
		}
	}

	return {
		ok: true,
		value: { role, email, displayName: name || null, birthYear },
	};
}

export interface PendingInvite {
	id: string;
	email: string;
	role: InviteRole;
	displayName: string | null;
	expiresAt: Date;
}

/** Whether a pending invite's link still works. */
export const isExpired = (
	invite: Pick<PendingInvite, 'expiresAt'>,
	now: Date,
) => invite.expiresAt.getTime() <= now.getTime();

/** Who can invite (or revoke an invite for) a role: only owners handle parents. */
export const canManageInvite = (
	actorRole: 'owner' | 'parent' | 'kid',
	inviteRole: InviteRole,
) => actorRole === 'owner' || (actorRole === 'parent' && inviteRole === 'kid');

/** The link an invitee opens to join. */
export const inviteLink = (origin: string, token: string) =>
	`${origin}/invite/${token}`;
