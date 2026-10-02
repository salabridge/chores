import type { RequestHandler } from './$types';

/**
 * Pinged on an interval while a managed kid profile is open. All the work
 * happens in `hooks.server.ts`, which asks Neon Auth for the session on every
 * request and relays the refreshed cookies, so this just needs to exist and
 * not be cached. See "Kid profiles" in the web README.
 */
export const GET: RequestHandler = ({ locals }) =>
	new Response(null, {
		status: locals.user ? 204 : 401,
		headers: { 'cache-control': 'no-store' },
	});
