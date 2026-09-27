import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.js';
import { building } from '$app/env';

export async function handle({ event, resolve }) {
	// Fetch current session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	console.info('Session info', session);

	// Make session and user available on server
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
