// First-party proxy for PostHog (SB-85): the SDK sends to /ingest on our own
// origin so ad blockers don't drop it, and this forwards to PostHog Cloud.
// Our session cookies are never forwarded.

import type { RequestEvent } from '@sveltejs/kit';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$app/env/public';
import { INGEST_PATH } from '../analytics.ts';

/** Request headers PostHog gets; everything else (cookies included) is dropped. */
const FORWARDED_REQUEST_HEADERS = [
	'accept',
	'accept-language',
	'content-type',
	'content-encoding',
	'user-agent',
];

/** Whether `pathname` is one the proxy handles. */
export function isIngestPath(pathname: string) {
	return pathname === INGEST_PATH || pathname.startsWith(`${INGEST_PATH}/`);
}

/**
 * Where `pathname` + `search` go upstream. The SDK's own scripts (`/static`,
 * `/array`) come from the assets host: https://us.i.posthog.com ->
 * https://us-assets.i.posthog.com.
 */
export function upstreamUrl(host: string, pathname: string, search: string) {
	const path = pathname.slice(INGEST_PATH.length) || '/';
	const assets = /^\/(static|array)\//.test(path);
	const origin = assets
		? host.replace(
				/^https:\/\/(\w+)\.i\.posthog\.com$/,
				'https://$1-assets.i.posthog.com',
			)
		: host;
	return `${origin}${path}${search}`;
}

/** Forwards an /ingest request to PostHog. 404 while analytics is off. */
export async function proxyToPostHog(event: RequestEvent): Promise<Response> {
	if (!PUBLIC_POSTHOG_KEY) return new Response('Not found', { status: 404 });

	const { request, url } = event;
	const headers = new Headers();
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	// PostHog geolocates from this; without it every event comes from Vercel.
	headers.set('x-forwarded-for', event.getClientAddress());

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const upstream = await fetch(
		upstreamUrl(PUBLIC_POSTHOG_HOST, url.pathname, url.search),
		{
			method: request.method,
			headers,
			body: hasBody ? await request.arrayBuffer() : undefined,
		},
	);

	// `fetch` has already decoded the body, so the upstream encoding and
	// length no longer describe it. PostHog sets no cookies we want either.
	const responseHeaders = new Headers(upstream.headers);
	for (const name of ['content-encoding', 'content-length', 'set-cookie']) {
		responseHeaders.delete(name);
	}
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders,
	});
}
