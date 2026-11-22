import { loadCalendarFeed } from '#lib/server/calendar.js';
import type { RequestHandler } from './$types';

/**
 * The household calendar feed (SB-101), at `/calendar/<token>.ics`. Calendar
 * apps fetch it on a schedule without a login, so the token in the link is the
 * credential: it has to be public (outside `(protected)`), and it answers 404
 * for anything that isn't a live token, without saying why. A parent can make a
 * new token from Account, which stops the old link.
 */
export const GET: RequestHandler = async ({ params }) => {
	const feed = await loadCalendarFeed(params.token);
	if (!feed) {
		return new Response('Not found', {
			status: 404,
			headers: { 'cache-control': 'no-store' },
		});
	}
	return new Response(feed, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'inline; filename="chores.ics"',
			// Clients poll on their own schedule; this just keeps a burst of
			// fetches (adding the link in several apps) off the database.
			'cache-control': 'private, max-age=300',
			// The link is a secret: keep it out of Referer headers.
			'referrer-policy': 'no-referrer',
			'x-robots-tag': 'noindex',
		},
	});
};
