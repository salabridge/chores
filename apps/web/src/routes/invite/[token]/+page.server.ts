import { withRedirect } from '#lib/auth-links.js';
import { signedInProblem } from '#lib/invite-accept.js';
import { hasAnyMembership, loadInvite } from '#lib/server/invite-accept.js';
import type { PageServerLoad } from './$types';

// An invite link (SB-66). Not under `(protected)`: someone opening it may not
// have an account yet, so they're offered sign-up or sign-in, both of which
// come back here. Signed in, they accept it with one button.
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
	const invite = await loadInvite(params.token);
	const user = locals.user;
	const here = url.pathname;
	return {
		token: params.token,
		invite,
		signedInAs: user?.email ?? null,
		problem:
			invite.status === 'open' && user
				? (signedInProblem(invite, user) ??
					((await hasAnyMembership(user.id)) ? 'already-in-household' : null))
				: null,
		signUpHref: withRedirect('/signup', here),
		signInHref: withRedirect('/login', here),
		hideNav: true,
	};
};
