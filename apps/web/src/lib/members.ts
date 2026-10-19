// Shared shapes for the parent portal's Members screen (SB-66).

export type HouseholdRole = 'owner' | 'parent' | 'kid';

export interface HouseholdMember {
	id: string;
	displayName: string;
	role: HouseholdRole;
	avatarColor: string | null;
	avatarInitial: string | null;
	birthYear: number | null;
	/** A kid profile with no login, run by a parent on the household's devices. */
	managed: boolean;
}

/**
 * Whether `actor` (a parent) may change `target`'s avatar. Mirrors the
 * `household_members_update` policy: owners can change anyone's, a parent
 * only their own and kids'. Kids never can.
 */
export function canEditMemberAvatar(
	actor: { id: string; role: HouseholdRole },
	target: { id: string; role: HouseholdRole },
): boolean {
	if (actor.role === 'owner') return true;
	if (actor.role === 'parent')
		return target.role === 'kid' || target.id === actor.id;
	return false;
}

/** How a member is described under their name ("Owner", "Managed kid"). */
export function memberLabel(
	member: Pick<HouseholdMember, 'role' | 'managed'>,
): string {
	switch (member.role) {
		case 'owner':
			return 'Owner';
		case 'parent':
			return 'Parent';
		case 'kid':
			return member.managed ? 'Managed kid' : 'Kid with own login';
	}
}

const ROLE_ORDER: Record<HouseholdRole, number> = {
	owner: 0,
	parent: 1,
	kid: 2,
};

/** Owners first, then parents, then kids; stable within a role. */
export function sortMembers<T extends { role: HouseholdRole }>(
	members: T[],
): T[] {
	return [...members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}
