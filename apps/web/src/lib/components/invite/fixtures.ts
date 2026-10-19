import type { CurrentHousehold, InviteView } from '#lib/invite-accept.js';

export const openKidInvite: InviteView = {
	status: 'open',
	email: 'ava@example.com',
	role: 'kid',
	householdName: 'Burbridge Household',
	inviterName: 'Jim',
};

export const openParentInvite: InviteView = {
	status: 'open',
	email: 'sam@example.com',
	role: 'parent',
	householdName: 'Burbridge Household',
	inviterName: null,
};

export const token = 'tok_EXAMPLEtoken0123456789abcdefghijklmnopq';

export const links = {
	signUpHref: '#signup',
	signInHref: '#login',
};

/** Pat owns another household (SB-76): the merge-confirm state. */
export const ownedHousehold: CurrentHousehold = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Pat Place',
	role: 'owner',
	merge: {
		members: [
			{ displayName: 'Pat', points: 0, you: true },
			{ displayName: 'Quinn', points: 0, you: false },
			{ displayName: 'Mia', points: 24, you: false },
			{ displayName: 'Leo', points: 1, you: false },
		],
		chores: 6,
		rewards: 2,
		completions: 41,
	},
};

/** Sam is a parent (not an owner) in another household: the leave state. */
export const joinedHousehold: CurrentHousehold = {
	id: '00000000-0000-4000-8000-000000000002',
	name: 'Pat Place',
	role: 'parent',
	merge: null,
};
