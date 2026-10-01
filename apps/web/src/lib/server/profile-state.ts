import { parentRoles } from '@chore/db';

/** The slice of a `household_members` row the profile logic needs. */
export interface MemberSummary {
	id: string;
	householdId: string;
	/** NULL for a managed kid, who has no login. */
	userId: string | null;
	role: 'owner' | 'parent' | 'kid';
	displayName: string;
	avatarColor: string | null;
	avatarInitial: string | null;
}

/**
 * Who the device is acting as for this request.
 *
 * - `self`: the signed-in user as their own member (a parent's own view, or an
 *   invited kid with their own login).
 * - `kid`: a parent's session acting as a managed kid. `member` is the kid;
 *   `actor` is the signed-in parent.
 */
export interface ProfileState {
	mode: 'self' | 'kid';
	/** The member whose chores, points and claims every kid-side read and write belongs to. */
	member: MemberSummary;
	/** The signed-in user's own member row (the parent in `kid` mode). */
	actor: MemberSummary;
}

export function isParentRole(role: MemberSummary['role']) {
	return (parentRoles as readonly string[]).includes(role);
}

/** A managed kid: a kid row with no login of its own. */
export function isManagedKid(member: MemberSummary) {
	return member.userId === null && member.role === 'kid';
}

/**
 * True when the signed-in user (`actor`) may open `kid` as a profile: `kid` is
 * a managed kid in the same household and the user is a parent there.
 */
export function canOpenKidProfile(actor: MemberSummary, kid: MemberSummary) {
	return (
		isParentRole(actor.role) &&
		isManagedKid(kid) &&
		kid.householdId === actor.householdId
	);
}

/**
 * Works out the acting profile from rows the server loaded itself. The
 * remembered kid (`activeMember`) is only honoured if the user may still open
 * it; otherwise it falls back to their own view, so a deleted or moved kid
 * can't leave the device stuck or acting across households.
 *
 * `memberships` are the signed-in user's own member rows. Returns null when
 * they aren't in a household yet.
 */
export function resolveProfile(
	memberships: MemberSummary[],
	activeMember: MemberSummary | null,
): ProfileState | null {
	const actor =
		memberships.find((m) => isParentRole(m.role)) ?? memberships[0] ?? null;
	if (!actor) return null;
	if (activeMember && canOpenKidProfile(actor, activeMember)) {
		return { mode: 'kid', member: activeMember, actor };
	}
	return { mode: 'self', member: actor, actor };
}

export type ParentGuardResult = 'allow' | 'kid-profile-active' | 'not-a-parent';

/**
 * Decides whether a parent-only route or action may run. A parent's session
 * is rejected while a kid profile is active; kids with their own login never
 * pass. With no household yet (`null`) the user can still reach setup pages.
 */
export function parentGuard(state: ProfileState | null): ParentGuardResult {
	if (!state) return 'allow';
	if (state.mode === 'kid') return 'kid-profile-active';
	return isParentRole(state.member.role) ? 'allow' : 'not-a-parent';
}
