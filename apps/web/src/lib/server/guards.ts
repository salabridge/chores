import { error } from '@sveltejs/kit';
import { requireUser } from './auth.ts';
import {
	type MemberSummary,
	type ProfileState,
	parentGuard,
} from './profile-state.ts';
import { getProfileState } from './profiles.ts';

// Guards for kid profiles (SB-51). The signed-in session belongs to a parent
// even while a kid profile is active, so being signed in proves nothing about
// who is holding the device. Use these instead of reading `locals.user`:
//
// - `getCurrentMember()`: the member every kid-side read and write belongs to
//   (completions, points, claims). Never use the auth user id for that.
// - `requireParentProfile()`: parent-only routes and actions (the SB-45 guard,
//   SB-29 actions, reopen). Rejects while a kid profile is active.
// - `requireNotKidProfile()`: actions anyone but a kid profile may take, such
//   as signing out or changing the account password.
//
// Pages in the `(protected)/(parent)` group are guarded in `hooks.server.ts`.
// Remote functions and endpoints skip that, so they must call a guard.

/** The signed-in user's profile for this request, or a 403 if they're not in a household. */
export async function requireProfile(): Promise<ProfileState> {
	requireUser();
	const state = await getProfileState();
	if (!state) error(403, 'Join or create a household first.');
	return state;
}

/**
 * The member the current request acts as: the active managed kid, or the
 * signed-in user's own member. Credit points, completions and claims to this
 * member's id, and take the household id from it.
 */
export async function getCurrentMember(): Promise<MemberSummary> {
	return (await requireProfile()).member;
}

/** Rejects (403) unless a parent is using their own view; a kid profile never passes. */
export async function requireParentProfile(): Promise<ProfileState> {
	requireUser();
	const state = await getProfileState();
	switch (parentGuard(state)) {
		case 'kid-profile-active':
			error(403, 'A parent has to leave this kid profile first.');
			break;
		case 'not-a-parent':
			error(403, 'Only a parent can do this.');
			break;
	}
	if (!state) error(403, 'Join or create a household first.');
	return state;
}

/** Rejects (403) while a managed kid profile is active, for actions that need the PIN first. */
export async function requireNotKidProfile(): Promise<void> {
	const state = await getProfileState();
	if (state?.mode === 'kid') {
		error(403, 'Enter the parent PIN to leave this kid profile first.');
	}
}
