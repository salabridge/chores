import { withRedirect } from '#lib/auth-links.js';
import { signedInProblem } from '#lib/invite-accept.js';
import { loadInvite } from '#lib/server/invite-accept.js';
import type { PageServerLoad } from './$types';

// An invite link (SB-66). Not under `(protected)`: someone opening it may not
// have an account yet, so they're offered sign-up or sign-in, both of which
// come back here. Signed in, they accept it with one button.
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const invite = await loadInvite(params.token);
	const user = locals.user;
	const here = url.pathname;
	return {
		token: params.token,
		invite,
		signedInAs: user?.email ?? null,
		problem:
			invite.status === 'open' && user ? signedInProblem(invite, user) : null,
		signUpHref: withRedirect('/signup', here),
		signInHref: withRedirect('/login', here),
		hideNav: true,
	};
};
