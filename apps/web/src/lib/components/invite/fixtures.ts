import type { InviteView } from '#lib/invite-accept.js';

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
