import type { HouseholdMember } from '#lib/members.js';

/** A household with one of each kind of member, for specs and stories. */
export const members: HouseholdMember[] = [
	{
		id: 'm1',
		displayName: 'Jim',
		role: 'owner',
		avatarColor: 'orange',
		birthYear: null,
		managed: false,
	},
	{
		id: 'm2',
		displayName: 'Sam',
		role: 'parent',
		avatarColor: 'green',
		birthYear: null,
		managed: false,
	},
	{
		id: 'm3',
		displayName: 'Mia',
		role: 'kid',
		avatarColor: 'blue',
		birthYear: 2017,
		managed: true,
	},
	{
		id: 'm4',
		displayName: 'Ava',
		role: 'kid',
		avatarColor: 'amber',
		birthYear: null,
		managed: false,
	},
];
