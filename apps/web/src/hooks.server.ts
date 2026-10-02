import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { fetchSession, hasSessionCookie, signInUrl } from '#lib/server/auth.js';
import { parentGuard } from '#lib/server/profile-state.js';
import { getProfileState } from '#lib/server/profiles.js';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	if (hasSessionCookie(event.cookies)) {
		try {
			const current = await fetchSession();
			if (current) {
				event.locals.user = current.user;
				event.locals.session = current.session;
			}
		} catch (error) {
			// Treat an unreachable auth server as signed out rather than 500ing
			// every page.
			console.error('Could not load session from Neon Auth', error);
		}
	}

	// Guarding here (not in a layout load) also covers `__data.json` requests
	// and endpoints under the group, which a layout load can be skipped for.
	if (event.route.id?.startsWith('/(protected)') && !event.locals.user) {
		redirect(303, signInUrl(event.url));
	}

	// Parent-only pages. While a kid profile is active the session still belongs
	// to the parent, so signing in isn't enough: send kids to their own screens.
	// Remote functions and endpoints don't pass through a route group; they call
	// `requireParentProfile()` from `#lib/server/guards.js`.
	if (event.route.id?.startsWith('/(protected)/(parent)')) {
		// Fails closed: if the profile can't be loaded this throws a 500.
		const verdict = parentGuard(await getProfileState());
		if (verdict !== 'allow') {
			if (event.request.method === 'GET') redirect(303, '/today');
			error(403, 'Parents only.');
		}
	}

	return resolve(event);
};
