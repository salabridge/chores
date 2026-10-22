import type { RequestEvent } from '@sveltejs/kit';
import type { EventMessage } from 'posthog-node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `$app/env/public` is mocked so each test picks whether analytics is on, and
// the SDK is mocked so the tests can tell whether it was ever loaded.
const env = vi.hoisted(() => ({
	PUBLIC_POSTHOG_KEY: undefined as string | undefined,
	PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
}));
vi.mock('$app/env/public', () => env);

const posthog = vi.hoisted(() => ({
	loaded: false,
	options: undefined as unknown,
	captureExceptionImmediate: vi.fn(async () => {}),
}));
vi.mock('posthog-node', () => {
	posthog.loaded = true;
	return {
		PostHog: class {
			captureExceptionImmediate = posthog.captureExceptionImmediate;
			constructor(_key: string, options: unknown) {
				posthog.options = options;
			}
		},
	};
});

const { browserIdentity, captureServerError, scrubServerEvent } = await import(
	'./error-tracking.ts'
);

const KEY = 'phc_test';

function requestEvent(path: string, cookies: Record<string, string> = {}) {
	return {
		url: new URL(`https://chores.example${path}`),
		route: { id: '/invite/[token]' },
		cookies: { get: (name: string) => cookies[name] },
	} as unknown as RequestEvent;
}

function phCookie(value: unknown): Record<string, string> {
	return { [`ph_${KEY}_posthog`]: JSON.stringify(value) };
}

beforeEach(() => {
	env.PUBLIC_POSTHOG_KEY = undefined;
	posthog.captureExceptionImmediate.mockClear();
});

describe('with no PUBLIC_POSTHOG_KEY', () => {
	it('never loads the SDK and sends nothing', async () => {
		await captureServerError(new Error('boom'), requestEvent('/today'));
		expect(posthog.loaded).toBe(false);
		expect(posthog.captureExceptionImmediate).not.toHaveBeenCalled();
	});
});

describe('browserIdentity', () => {
	it("reads the browser's id, and whether it was identified", () => {
		const cookies = phCookie({ distinct_id: 'u1', $user_state: 'identified' });
		expect(browserIdentity({ get: (n) => cookies[n] }, KEY)).toEqual({
			distinctId: 'u1',
			identified: true,
		});

		const anon = phCookie({ distinct_id: 'anon', $user_state: 'anonymous' });
		expect(browserIdentity({ get: (n) => anon[n] }, KEY)).toEqual({
			distinctId: 'anon',
			identified: false,
		});
	});

	it('is undefined with no cookie, or one it cannot read', () => {
		expect(browserIdentity({ get: () => undefined }, KEY)).toBeUndefined();
		expect(browserIdentity({ get: () => '{not json' }, KEY)).toBeUndefined();
		expect(
			browserIdentity({ get: () => JSON.stringify({ distinct_id: 7 }) }, KEY),
		).toBeUndefined();
	});
});

describe('scrubServerEvent', () => {
	it('scrubs URLs in the message and stack frames', () => {
		const event = {
			event: '$exception',
			distinctId: 'anon',
			properties: {
				$exception_list: [
					{
						value: 'Bad link https://chores.example/invite/secret?x=1',
						stacktrace: {
							frames: [{ filename: '/var/task/invite/secret.js', lineno: 3 }],
						},
					},
				],
			},
		} as EventMessage;

		expect(scrubServerEvent(event).properties).toEqual({
			$exception_list: [
				{
					value: 'Bad link https://chores.example/invite/[token]',
					stacktrace: {
						frames: [{ filename: '/var/task/invite/[token]', lineno: 3 }],
					},
				},
			],
		});
	});
});

describe('with a key', () => {
	beforeEach(() => {
		env.PUBLIC_POSTHOG_KEY = KEY;
	});

	it('sends right away, with only the scrubbed URL and route', async () => {
		const error = new Error('boom');
		await captureServerError(
			error,
			requestEvent(
				'/invite/secret?redirectTo=x',
				phCookie({ distinct_id: 'u1', $user_state: 'identified' }),
			),
		);
		expect(posthog.options).toMatchObject({
			host: 'https://us.i.posthog.com',
			flushAt: 1,
			before_send: scrubServerEvent,
		});
		expect(posthog.captureExceptionImmediate).toHaveBeenCalledWith(
			error,
			'u1',
			{
				$current_url: 'https://chores.example/invite/[token]',
				route: '/invite/[token]',
			},
		);
	});

	it('gives kids and visitors no person profile', async () => {
		await captureServerError(
			new Error('boom'),
			requestEvent(
				'/today',
				phCookie({ distinct_id: 'anon', $user_state: 'anonymous' }),
			),
		);
		expect(posthog.captureExceptionImmediate).toHaveBeenLastCalledWith(
			expect.any(Error),
			'anon',
			expect.objectContaining({ $process_person_profile: false }),
		);

		await captureServerError(new Error('boom'), requestEvent('/today'));
		expect(posthog.captureExceptionImmediate).toHaveBeenLastCalledWith(
			expect.any(Error),
			undefined,
			expect.objectContaining({ $process_person_profile: false }),
		);
	});

	it('never throws when sending fails', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		posthog.captureExceptionImmediate.mockRejectedValueOnce(new Error('down'));
		await expect(
			captureServerError(new Error('boom'), requestEvent('/today')),
		).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});
