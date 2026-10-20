import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `$app/env/public` is mocked so each test picks whether analytics is on.
const env = vi.hoisted(() => ({
	PUBLIC_POSTHOG_KEY: 'phc_test' as string | undefined,
	PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
}));
vi.mock('$app/env/public', () => env);

const { isIngestPath, proxyToPostHog, upstreamUrl } = await import(
	'./posthog-proxy.ts'
);

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	env.PUBLIC_POSTHOG_KEY = 'phc_test';
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(
		new Response('{"status":1}', {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'content-encoding': 'gzip',
				'set-cookie': 'x=1',
			},
		}),
	);
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function ingestEvent(path: string, init: RequestInit = {}) {
	const url = new URL(`https://chores.example${path}`);
	return {
		url,
		request: new Request(url, init),
		getClientAddress: () => '203.0.113.7',
	} as unknown as RequestEvent;
}

describe('isIngestPath', () => {
	it('matches /ingest and below only', () => {
		expect(isIngestPath('/ingest')).toBe(true);
		expect(isIngestPath('/ingest/e/')).toBe(true);
		expect(isIngestPath('/ingestion')).toBe(false);
		expect(isIngestPath('/today')).toBe(false);
	});
});

describe('upstreamUrl', () => {
	it('sends events to the host and SDK scripts to the assets host', () => {
		const host = 'https://us.i.posthog.com';
		expect(upstreamUrl(host, '/ingest/e/', '?ver=1')).toBe(
			'https://us.i.posthog.com/e/?ver=1',
		);
		expect(upstreamUrl(host, '/ingest/static/array.js', '')).toBe(
			'https://us-assets.i.posthog.com/static/array.js',
		);
		expect(upstreamUrl('https://eu.i.posthog.com', '/ingest/array/x', '')).toBe(
			'https://eu-assets.i.posthog.com/array/x',
		);
	});
});

describe('proxyToPostHog', () => {
	it('404s without a key and sends nothing', async () => {
		env.PUBLIC_POSTHOG_KEY = undefined;
		const response = await proxyToPostHog(ingestEvent('/ingest/e/'));
		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('forwards the body but never our cookies', async () => {
		const response = await proxyToPostHog(
			ingestEvent('/ingest/e/?compression=gzip-js', {
				method: 'POST',
				body: 'payload',
				headers: {
					'content-type': 'text/plain',
					cookie: 'neon-auth.session_token=secret',
					authorization: 'Bearer secret',
				},
			}),
		);

		const [target, init] = fetchMock.mock.calls[0];
		expect(target).toBe('https://us.i.posthog.com/e/?compression=gzip-js');
		const headers = new Headers(init?.headers);
		expect(headers.get('cookie')).toBeNull();
		expect(headers.get('authorization')).toBeNull();
		expect(headers.get('content-type')).toBe('text/plain');
		expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
		expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe('payload');

		expect(response.status).toBe(200);
		expect(response.headers.get('content-encoding')).toBeNull();
		expect(response.headers.get('set-cookie')).toBeNull();
		expect(await response.text()).toBe('{"status":1}');
	});
});
