// Server errors to PostHog error tracking (SB-89). Off unless
// PUBLIC_POSTHOG_KEY is set: without it `posthog-node` is never imported.
// Same privacy rules as the browser (see "Analytics" in the web README): only
// the error and the scrubbed URL and route are sent, never the request body,
// form data, headers or cookies, and nobody is identified from the session.

import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { EventMessage, PostHog } from 'posthog-node';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$app/env/public';
import { scrubUrl, scrubValue } from '../analytics.ts';

/** `before_send` for the server client: scrubs every string the event carries. */
export function scrubServerEvent(event: EventMessage): EventMessage {
	return {
		...event,
		properties:
			event.properties &&
			(scrubValue(event.properties) as EventMessage['properties']),
	};
}

/** Who the browser's SDK knows the device as, from its cookie. */
export interface BrowserIdentity {
	distinctId: string;
	/** `identify` was called: a parent. Kids and visitors stay anonymous. */
	identified: boolean;
}

/**
 * The browser's PostHog id, from the cookie `posthog-js` keeps
 * (`ph_<key>_posthog`), or `undefined` without one. This reuses whatever id
 * the browser already sends: a parent's user id, or an anonymous id for a kid
 * or visitor. Never look a kid up from the session instead.
 */
export function browserIdentity(
	cookies: Pick<Cookies, 'get'>,
	key: string,
): BrowserIdentity | undefined {
	const raw = cookies.get(`ph_${key}_posthog`);
	if (!raw) return undefined;
	try {
		const { distinct_id, $user_state } = JSON.parse(raw);
		if (typeof distinct_id !== 'string' || !distinct_id) return undefined;
		return {
			distinctId: distinct_id.slice(0, 200),
			identified: $user_state === 'identified',
		};
	} catch {
		return undefined;
	}
}

let client: Promise<PostHog> | undefined;

function getClient(key: string) {
	client ??= import('posthog-node').then(
		({ PostHog }) =>
			new PostHog(key, {
				host: PUBLIC_POSTHOG_HOST,
				flushAt: 1,
				before_send: scrubServerEvent,
			}),
	);
	return client;
}

/**
 * Reports an error from `handleError` and waits until it's sent: on Vercel
 * the function can stop as soon as the response is out, and a queued event
 * would be lost. Never throws.
 */
export async function captureServerError(error: unknown, event: RequestEvent) {
	const key = PUBLIC_POSTHOG_KEY;
	if (!key) return;
	try {
		const identity = browserIdentity(event.cookies, key);
		const ph = await getClient(key);
		await ph.captureExceptionImmediate(error, identity?.distinctId, {
			$current_url: scrubUrl(event.url.href),
			route: event.route.id ?? '(not found)',
			// Kids and visitors get no person profile, as in the browser
			// (`person_profiles: 'identified_only'`).
			...(identity?.identified ? {} : { $process_person_profile: false }),
		});
	} catch (captureError) {
		console.error('Could not report an error to PostHog', captureError);
	}
}
