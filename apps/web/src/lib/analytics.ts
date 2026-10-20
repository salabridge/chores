// Product analytics through PostHog (SB-85). Browser only, and off unless
// PUBLIC_POSTHOG_KEY is set: without it `posthog-js` is never imported, so
// nothing loads and nothing is sent. Kids use this app, so the rules are
// strict (see "Analytics" in the web README): only parents are identified,
// session replay is off, autocapture keeps no text, and URLs are scrubbed.

import type { CaptureResult, PostHog, PostHogConfig } from 'posthog-js';

/**
 * Who analytics may know the device as, worked out on the server from the
 * profile state (`analyticsIdentity` in `#lib/server/profile-state.js`).
 *
 * - `parent`: a parent or owner in their own view. Identified by their Neon
 *   Auth user id and grouped by household. Never their email or name.
 * - `kid`: a kid's own login, or a parent's device acting as a managed kid.
 *   Anonymous, tagged only with `role: kid`.
 * - `null`: signed out, or signed in without a household yet.
 */
export type AnalyticsIdentity =
	| { role: 'parent'; userId: string; householdId: string }
	| { role: 'kid' }
	| null;

/** Same-origin path the SDK sends to; `hooks.server.ts` proxies it to PostHog. */
export const INGEST_PATH = '/ingest';

/** Route id for pages no route matched. */
const NOT_FOUND_ROUTE = '(not found)';

const INVITE_TOKEN = /\/invite\/[^/?#"'\s]+/g;

/**
 * A URL or path with nothing in it that acts as a credential: the query and
 * hash are dropped (`redirectTo` can carry an invite link), and an invite
 * token is replaced by its route parameter. Anything that isn't a URL only
 * has invite paths in it replaced.
 */
export function scrubUrl(value: string): string {
	if (/^https?:\/\//i.test(value)) {
		try {
			const url = new URL(value);
			return url.origin + url.pathname.replace(INVITE_TOKEN, '/invite/[token]');
		} catch {
			// Not a URL after all; fall through to the path rewrite.
		}
	}
	return value.replace(INVITE_TOKEN, '/invite/[token]');
}

function scrubValue(value: unknown): unknown {
	if (typeof value === 'string') return scrubUrl(value);
	if (Array.isArray(value)) return value.map(scrubValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, scrubValue(v)]),
		);
	}
	return value;
}

/**
 * PostHog's `before_send`: scrubs every string the event carries (including
 * `$set` / `$set_once`, where the SDK keeps the initial URL and referrer), and
 * drops the page title, which names the chore on a chore page.
 */
export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
	if (!event) return null;
	const { title: _title, $title: _$title, ...properties } = event.properties;
	return {
		...event,
		properties: scrubValue(properties) as CaptureResult['properties'],
		$set: event.$set && (scrubValue(event.$set) as CaptureResult['$set']),
		$set_once:
			event.$set_once &&
			(scrubValue(event.$set_once) as CaptureResult['$set_once']),
	};
}

/** The SDK settings. Everything that could record a kid is off. */
export function posthogConfig(host: string): Partial<PostHogConfig> {
	return {
		api_host: INGEST_PATH,
		// Links from the toolbar and debug output go to the PostHog app, not
		// the ingestion host: https://us.i.posthog.com -> https://us.posthog.com.
		ui_host: host.replace('.i.posthog.com', '.posthog.com'),
		defaults: '2026-08-30',
		// Only identified parents get person profiles; kids stay anonymous.
		person_profiles: 'identified_only',
		// Pageviews are captured in `trackPageview` with the route id, after
		// SvelteKit's client-side navigation finishes.
		capture_pageview: false,
		capture_pageleave: false,
		disable_session_recording: true,
		// Clicks are still autocaptured, but with no element text or attribute
		// values: those hold chore and kid names, and input values.
		autocapture: true,
		mask_all_text: true,
		mask_all_element_attributes: true,
		capture_exceptions: false,
		disable_surveys: true,
		disable_product_tours: true,
		disable_conversations: true,
		disable_web_experiments: true,
		advanced_disable_flags: true,
		before_send: scrubEvent,
	};
}

/** The parts of the PostHog client identity syncing uses. */
export type IdentityClient = Pick<
	PostHog,
	| 'get_property'
	| 'get_distinct_id'
	| 'identify'
	| 'group'
	| 'register'
	| 'reset'
>;

/**
 * Brings the SDK's identity in line with `identity`. Whenever the person on
 * the device changes (sign-out, a kid profile opening or closing, another
 * parent signing in), the SDK is reset first: `identify` merges the anonymous
 * id's history into the person, and a shared family device mustn't merge a
 * kid, or another parent, into whoever signs in next.
 */
export function syncIdentity(ph: IdentityClient, identity: AnalyticsIdentity) {
	const current = ph.get_property('role') as 'parent' | 'kid' | undefined;
	if (identity?.role === 'parent') {
		if (current === 'parent' && ph.get_distinct_id() === identity.userId) {
			return;
		}
		if (current) ph.reset();
		ph.identify(identity.userId);
		ph.group('household', identity.householdId);
		ph.register({ role: 'parent' });
	} else if (identity?.role === 'kid') {
		if (current === 'kid') return;
		if (current) ph.reset();
		ph.register({ role: 'kid' });
	} else if (current) {
		ph.reset();
	}
}

let client: Promise<PostHog | null> = Promise.resolve(null);
let started = false;

/**
 * Loads and starts the SDK, once, if `key` is set. Call from the browser only.
 * Calls made before it finishes loading wait for it; with no key they do
 * nothing.
 */
export function initAnalytics(key: string | undefined, host: string) {
	if (!key || started) return client;
	started = true;
	client = import('posthog-js').then(({ default: posthog }) => {
		posthog.init(key, posthogConfig(host));
		return posthog;
	});
	return client;
}

/** See `syncIdentity`. */
export function identify(identity: AnalyticsIdentity) {
	return client.then((ph) => ph && syncIdentity(ph, identity));
}

/**
 * Records a pageview named by the route id (`/(protected)/(app)/chores/[id]`),
 * which groups pages by route and keeps ids and tokens out of the name. The
 * route also goes on every later event.
 */
export function trackPageview(routeId: string | null | undefined) {
	return client.then((ph) => {
		if (!ph) return;
		ph.register({ route: routeId ?? NOT_FOUND_ROUTE });
		ph.capture('$pageview');
	});
}
