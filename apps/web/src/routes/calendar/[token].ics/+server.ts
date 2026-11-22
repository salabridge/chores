import { createHash } from 'node:crypto';
import { loadCalendarFeed } from '#lib/server/calendar.js';
import type { RequestHandler } from './$types';

/**
 * The household calendar feed (SB-101), at `/calendar/<token>.ics`. Calendar
 * apps fetch it on a schedule without a login, so the token in the link is the
 * credential: it has to be public (outside `(protected)`), and it answers 404
 * for anything that isn't a live token, without saying why. A parent can make a
 * new token from Account, which stops the old link.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const feed = await loadCalendarFeed(params.token);
	if (!feed) {
		return new Response('Not found', {
			status: 404,
			headers: { 'cache-control': 'no-store' },
		});
	}
	// `DTSTAMP` changes on every fetch, so leave it out: the tag only moves when
	// an entry does, and a client that polls hourly gets a 304 with no body.
	const etag = `"${createHash('sha256')
		.update(feed.replace(/^DTSTAMP:.*$/gm, ''))
		.digest('base64url')
		.slice(0, 22)}"`;
	const cacheHeaders = {
		etag,
		// Clients poll on their own schedule; this just keeps a burst of
		// fetches (adding the link in several apps) off the database.
		'cache-control': 'private, max-age=300',
	};
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers: cacheHeaders });
	}
	return new Response(feed, {
		headers: {
			...cacheHeaders,
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'inline; filename="chores.ics"',
			// The link is a secret: keep it out of Referer headers.
			'referrer-policy': 'no-referrer',
			'x-robots-tag': 'noindex',
		},
	});
};
