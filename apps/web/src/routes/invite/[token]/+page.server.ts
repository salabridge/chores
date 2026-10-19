import { withRedirect } from '#lib/auth-links.js';
import { type InviteProblem, signedInProblem } from '#lib/invite-accept.js';
import { loadCurrentHousehold, readInvite } from '#lib/server/invite-accept.js';
import type { PageServerLoad } from './$types';

// An invite link (SB-66). Not under `(protected)`: someone opening it may not
// have an account yet, so they're offered sign-up or sign-in, both of which
// come back here. Signed in, they accept it with one button. Someone already
// in another household can leave it, or move it in as its owner (SB-76).
export const load: PageServerLoad = async ({
	params,
	locals,
	url,
	setHeaders,
}) => {
	// The page carries a live credential (the token) and the invitee's email:
	// keep it out of caches, Referer headers and search indexes from the
	// first byte, not only once the browser has parsed <head>.
	setHeaders({
		'cache-control': 'private, no-store',
		'referrer-policy': 'no-referrer',
		'x-robots-tag': 'noindex',
	});
	const { view: invite, householdId } = await readInvite(params.token);
	const user = locals.user;
	const here = url.pathname;

	let problem: InviteProblem | null = null;
	let current = null;
	if (invite.status === 'open' && user) {
		problem = signedInProblem(invite, user);
		if (!problem) {
			current = await loadCurrentHousehold(user.id);
			if (current) {
				problem =
					current.id === householdId
						? 'already-member'
						: 'already-in-household';
			}
			if (problem !== 'already-in-household') current = null;
		}
	}
	return {
		token: params.token,
		invite,
		signedInAs: user?.email ?? null,
		problem,
		current,
		signUpHref: withRedirect('/signup', here),
		signInHref: withRedirect('/login', here),
		hideNav: true,
	};
};
