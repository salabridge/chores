import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { fetchSession, hasSessionCookie, signInUrl } from '#lib/server/auth.js';

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

	return resolve(event);
};
