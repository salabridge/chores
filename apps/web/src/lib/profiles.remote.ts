import { error, invalid, redirect } from '@sveltejs/kit';
import { requireUser, verifyAccountPassword } from '#lib/server/auth.js';
import { requireProfile } from '#lib/server/guards.js';
import { hashPin, isValidPin } from '#lib/server/pin.js';
import { checkPin, pinFailureMessage } from '#lib/server/pin-lock.js';
import { pinStore, savePinHash } from '#lib/server/pin-store.js';
import {
	canOpenKidProfile,
	isParentRole,
	type MemberSummary,
} from '#lib/server/profile-state.js';
import { getMember, setActiveMember } from '#lib/server/profiles.js';
import { form } from '$app/server';

// Remote functions for managed kid profiles (SB-51). The member id a client
// sends is only ever a *request*: it is checked against rows the server loads
// itself (`canOpenKidProfile`) before it can become the active profile.

/** Resolves a requested kid id to a member the signed-in parent may open, or 403s. */
async function openableKid(actor: MemberSummary, memberId: unknown) {
	const kid = typeof memberId === 'string' ? await getMember(memberId) : null;
	if (!kid || !canOpenKidProfile(actor, kid)) {
		error(403, 'You cannot open that profile.');
	}
	return kid;
}

/**
 * Picker choice, from a parent's own view (no PIN needed to enter a kid
 * profile, but a PIN has to exist so the kid can't be left without a lock).
 * Choosing the parent clears any kid profile.
 */
export const selectProfile = form(
	'unchecked',
	async (data: { memberId: string }) => {
		const { mode, actor } = await requireProfile();
		if (mode === 'kid') {
			error(403, 'Enter the parent PIN to leave this kid profile first.');
		}
		if (!isParentRole(actor.role)) error(403, 'Only a parent can do this.');

		if (data.memberId === actor.id) {
			await setActiveMember(null);
			redirect(303, '/today');
		}
		const kid = await openableKid(actor, data.memberId);
		if (!(await pinStore.get(actor.id))) {
			invalid('Set a parent PIN before opening a kid profile.');
		}
		await setActiveMember(kid.id);
		redirect(303, '/today');
	},
);

/**
 * Leaves a managed kid profile, for the parent view or another kid. Needs the
 * parent PIN, with the rate limit and lockout from `pin-lock.ts`.
 */
export const leaveKidProfile = form(
	'unchecked',
	async (data: { _pin: string; target?: string }) => {
		const { mode, actor } = await requireProfile();
		if (mode !== 'kid') redirect(303, '/profiles');

		const target = data.target || 'parent';
		// Resolve the target first so a bad request can't cost a PIN attempt.
		const kid = target === 'parent' ? null : await openableKid(actor, target);

		const pin = String(data._pin ?? '');
		if (!isValidPin(pin)) invalid('Enter your 4 to 6 digit PIN.');
		const check = await checkPin(pinStore, actor.id, pin);
		if (!check.ok) invalid(pinFailureMessage(check));

		await setActiveMember(kid?.id ?? null);
		redirect(303, kid ? '/today' : '/profiles');
	},
);

/**
 * Sets the parent PIN. The first PIN can be set from the parent's own view;
 * changing or resetting one needs the account password, from any mode (a
 * parent who forgot the PIN is usually stuck inside a kid profile).
 */
export const savePin = form(
	'unchecked',
	async (data: { _pin: string; _confirmPin: string; _password?: string }) => {
		const user = requireUser();
		const { mode, actor } = await requireProfile();
		if (!isParentRole(actor.role)) error(403, 'Only a parent can do this.');

		const pin = String(data._pin ?? '');
		if (!isValidPin(pin)) invalid('Choose a PIN of 4 to 6 digits.');
		if (pin !== String(data._confirmPin ?? ''))
			invalid('The PINs do not match.');

		if (await pinStore.get(actor.id)) {
			const password = String(data._password ?? '');
			if (!password) invalid('Enter your account password to change the PIN.');
			if (!(await verifyAccountPassword(user.email, password))) {
				invalid('Incorrect account password.');
			}
		} else if (mode === 'kid') {
			error(403, 'A parent has to leave this kid profile first.');
		}

		await savePinHash(actor.id, await hashPin(pin));
		return { saved: true };
	},
);

/** Clears a PIN lockout once the parent proves who they are with the account password. */
export const unlockPin = form(
	'unchecked',
	async (data: { _password: string }) => {
		const user = requireUser();
		const { actor } = await requireProfile();
		if (!isParentRole(actor.role)) error(403, 'Only a parent can do this.');

		const password = String(data._password ?? '');
		if (!password) invalid('Enter your account password.');
		if (!(await verifyAccountPassword(user.email, password))) {
			invalid('Incorrect account password.');
		}
		await pinStore.reset(actor.id);
		return { unlocked: true };
	},
);
