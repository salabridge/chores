import type { PendingInvite } from '#lib/invites.js';
import type { HouseholdMember } from '#lib/members.js';

/** A household with one of each kind of member, for specs and stories. */
export const members: HouseholdMember[] = [
	{
		id: 'm1',
		displayName: 'Jim',
		role: 'owner',
		avatarColor: 'orange',
		avatarInitial: null,
		birthYear: null,
		managed: false,
	},
	{
		id: 'm2',
		displayName: 'Sam',
		role: 'parent',
		avatarColor: 'green',
		avatarInitial: null,
		birthYear: null,
		managed: false,
	},
	{
		id: 'm3',
		displayName: 'Mia',
		role: 'kid',
		avatarColor: 'blue',
		avatarInitial: null,
		birthYear: 2017,
		managed: true,
	},
	{
		id: 'm4',
		displayName: 'Ava',
		role: 'kid',
		avatarColor: 'amber',
		avatarInitial: null,
		birthYear: null,
		managed: false,
	},
];

/** Pending invites around 2026-10-18: one live parent, one live kid, one expired. */
export const inviteNow = new Date('2026-10-18T12:00:00Z');

export const invites: PendingInvite[] = [
	{
		id: 'i1',
		email: 'sam@example.com',
		role: 'parent',
		displayName: 'Sam',
		expiresAt: new Date('2026-10-24T12:00:00Z'),
	},
	{
		id: 'i2',
		email: 'ava@example.com',
		role: 'kid',
		displayName: null,
		expiresAt: new Date('2026-10-22T12:00:00Z'),
	},
	{
		id: 'i3',
		email: 'leo@example.com',
		role: 'kid',
		displayName: 'Leo',
		expiresAt: new Date('2026-10-10T12:00:00Z'),
	},
];
