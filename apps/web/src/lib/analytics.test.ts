import type { CaptureResult } from 'posthog-js';
import { describe, expect, it, vi } from 'vitest';

// The SDK is mocked so the tests can tell whether it was ever loaded.
const posthog = vi.hoisted(() => ({
	loaded: false,
	init: vi.fn(),
	register: vi.fn(),
	capture: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock('posthog-js', () => {
	posthog.loaded = true;
	return { default: posthog };
});

const {
	captureException,
	initAnalytics,
	identify,
	posthogConfig,
	scrubEvent,
	scrubUrl,
	syncIdentity,
	track,
	trackPageview,
} = await import('./analytics.ts');

describe('with no PUBLIC_POSTHOG_KEY', () => {
	it('never loads the SDK, and later calls send nothing', async () => {
		await initAnalytics(undefined, 'https://us.i.posthog.com');
		await initAnalytics('', 'https://us.i.posthog.com');
		await trackPageview('/(protected)/(app)/today');
		await track('household_created', {});
		await identify({ role: 'parent', userId: 'u1', householdId: 'h1' });
		await captureException(new Error('boom'));
		expect(posthog.loaded).toBe(false);
		expect(posthog.init).not.toHaveBeenCalled();
	});
});

describe('scrubUrl', () => {
	it('drops the query and hash, and the token from invite links', () => {
		expect(
			scrubUrl('https://chores.example/login?redirectTo=%2Finvite%2Fabc#x'),
		).toBe('https://chores.example/login');
		expect(scrubUrl('https://chores.example/invite/abc_-1')).toBe(
			'https://chores.example/invite/[token]',
		);
		expect(scrubUrl('/invite/abc_-1')).toBe('/invite/[token]');
	});

	it('cuts the query from URLs and paths inside other text', () => {
		expect(
			scrubUrl(
				'Failed to fetch https://chores.example/login?redirectTo=%2Finvite%2Fabc (500)',
			),
		).toBe('Failed to fetch https://chores.example/login (500)');
		expect(scrubUrl('GET /invite/abc?x=1#y failed')).toBe(
			'GET /invite/[token] failed',
		);
	});

	it('leaves other text alone', () => {
		expect(scrubUrl('/(protected)/(app)/today')).toBe(
			'/(protected)/(app)/today',
		);
		expect(scrubUrl('button')).toBe('button');
	});
});

describe('scrubEvent', () => {
	it('scrubs URLs everywhere, including $set_once, and drops the page title', () => {
		const event = {
			uuid: 'e1',
			event: '$pageview',
			properties: {
				$current_url: 'https://chores.example/invite/secret?x=1',
				$referrer: 'https://mail.example/inbox?id=7',
				title: 'Feed the cat · ChoreLoop',
				route: '/invite/[token]',
				count: 2,
			},
			$set_once: {
				$initial_current_url: 'https://chores.example/invite/secret',
			},
		} as unknown as CaptureResult;

		const scrubbed = scrubEvent(event);
		expect(scrubbed?.properties).toEqual({
			$current_url: 'https://chores.example/invite/[token]',
			$referrer: 'https://mail.example/inbox',
			route: '/invite/[token]',
			count: 2,
		});
		expect(scrubbed?.$set_once).toEqual({
			$initial_current_url: 'https://chores.example/invite/[token]',
		});
		expect(JSON.stringify(scrubbed)).not.toContain('secret');
	});

	it('scrubs URLs in exception messages and stack frames', () => {
		const event = {
			uuid: 'e2',
			event: '$exception',
			properties: {
				$exception_list: [
					{
						type: 'TypeError',
						value: 'Failed to load /invite/secret?redirectTo=x',
						stacktrace: {
							frames: [
								{
									filename: 'https://chores.example/_app/immutable/a.js?v=1',
									lineno: 1,
								},
							],
						},
					},
				],
			},
		} as unknown as CaptureResult;

		expect(scrubEvent(event)?.properties).toEqual({
			$exception_list: [
				{
					type: 'TypeError',
					value: 'Failed to load /invite/[token]',
					stacktrace: {
						frames: [
							{
								filename: 'https://chores.example/_app/immutable/a.js',
								lineno: 1,
							},
						],
					},
				},
			],
		});
	});

	it('scrubs URLs in replay snapshots and leaves the rest of them intact', () => {
		const snapshotData = [
			{
				type: 4,
				data: { href: 'https://chores.example/invite/secret?x=1' },
				timestamp: 1,
			},
			{
				type: 2,
				data: {
					node: {
						type: 2,
						tagName: 'a',
						attributes: { href: '/login?redirectTo=%2Finvite%2Fsecret' },
						childNodes: [{ type: 3, textContent: 'Sign in' }],
					},
					initialOffset: { top: 0, left: 0 },
				},
				timestamp: 2,
			},
		];
		const event = {
			uuid: 'e3',
			event: '$snapshot',
			properties: {
				$snapshot_data: snapshotData,
				$session_id: 's1',
			},
		} as unknown as CaptureResult;

		const scrubbed = scrubEvent(event);
		expect(scrubbed?.properties).toEqual({
			$snapshot_data: [
				{
					...snapshotData[0],
					data: { href: 'https://chores.example/invite/[token]' },
				},
				{
					...snapshotData[1],
					data: {
						...snapshotData[1].data,
						node: {
							...snapshotData[1].data.node,
							attributes: { href: '/login' },
						},
					},
				},
			],
			$session_id: 's1',
		});
		expect(JSON.stringify(scrubbed)).not.toContain('secret');
	});
});

describe('posthogConfig', () => {
	it('sends through /ingest with masked replay and no element text', () => {
		const config = posthogConfig('https://us.i.posthog.com');
		expect(config).toMatchObject({
			api_host: '/ingest',
			ui_host: 'https://us.posthog.com',
			person_profiles: 'identified_only',
			capture_pageview: false,
			disable_session_recording: false,
			session_recording: { maskAllInputs: true, compress_events: false },
			advanced_disable_feature_flags: true,
			mask_all_text: true,
			mask_all_element_attributes: true,
		});
	});

	it('captures uncaught errors and rejections, but not console errors', () => {
		expect(
			posthogConfig('https://us.i.posthog.com').capture_exceptions,
		).toEqual({
			capture_unhandled_errors: true,
			capture_unhandled_rejections: true,
			capture_console_errors: false,
		});
	});
});

function fakeClient(props: Record<string, unknown> = {}, distinctId = 'anon') {
	const state = { props: { ...props }, distinctId };
	return {
		state,
		get_property: vi.fn((key: string) => state.props[key]),
		get_distinct_id: vi.fn(() => state.distinctId),
		identify: vi.fn((id: string) => {
			state.distinctId = id;
		}),
		group: vi.fn(),
		register: vi.fn((p: Record<string, unknown>) => {
			Object.assign(state.props, p);
		}),
		reset: vi.fn(() => {
			state.props = {};
			state.distinctId = 'anon2';
		}),
	};
}

const parent = { role: 'parent', userId: 'u1', householdId: 'h1' } as const;

describe('syncIdentity', () => {
	it('identifies a parent by user id and groups them by household', () => {
		const ph = fakeClient();
		syncIdentity(ph, parent);
		expect(ph.reset).not.toHaveBeenCalled();
		expect(ph.identify).toHaveBeenCalledWith('u1');
		expect(ph.group).toHaveBeenCalledWith('household', 'h1');
		expect(ph.state.props).toEqual({ role: 'parent' });

		syncIdentity(ph, parent);
		expect(ph.identify).toHaveBeenCalledTimes(1);
	});

	it('never identifies a kid, and resets when a parent hands over the device', () => {
		const ph = fakeClient({ role: 'parent' }, 'u1');
		syncIdentity(ph, { role: 'kid' });
		expect(ph.reset).toHaveBeenCalledTimes(1);
		expect(ph.identify).not.toHaveBeenCalled();
		expect(ph.group).not.toHaveBeenCalled();
		expect(ph.state.props).toEqual({ role: 'kid' });
	});

	it("resets before a parent signs in after a kid, so the kid isn't merged in", () => {
		const ph = fakeClient({ role: 'kid' });
		syncIdentity(ph, parent);
		expect(ph.reset).toHaveBeenCalledTimes(1);
		expect(ph.identify).toHaveBeenCalledWith('u1');
	});

	it('resets when another parent signs in on the same device', () => {
		const ph = fakeClient({ role: 'parent' }, 'u2');
		syncIdentity(ph, parent);
		expect(ph.reset).toHaveBeenCalledTimes(1);
		expect(ph.identify).toHaveBeenCalledWith('u1');
	});

	it('resets on sign-out, and leaves an anonymous visitor alone', () => {
		const signedIn = fakeClient({ role: 'parent' }, 'u1');
		syncIdentity(signedIn, null);
		expect(signedIn.reset).toHaveBeenCalledTimes(1);

		const visitor = fakeClient();
		syncIdentity(visitor, null);
		expect(visitor.reset).not.toHaveBeenCalled();
	});
});

describe('with a key', () => {
	it('loads the SDK once and names pageviews by route', async () => {
		await initAnalytics('phc_test', 'https://us.i.posthog.com');
		await initAnalytics('phc_test', 'https://us.i.posthog.com');
		expect(posthog.init).toHaveBeenCalledTimes(1);
		expect(posthog.init).toHaveBeenCalledWith(
			'phc_test',
			expect.objectContaining({ api_host: '/ingest' }),
		);

		await trackPageview('/invite/[token]');
		expect(posthog.register).toHaveBeenCalledWith({ route: '/invite/[token]' });
		expect(posthog.capture).toHaveBeenCalledWith('$pageview');

		await trackPageview(null);
		expect(posthog.register).toHaveBeenLastCalledWith({ route: '(not found)' });
	});

	it('reports errors', async () => {
		const error = new Error('boom');
		await captureException(error);
		expect(posthog.captureException).toHaveBeenCalledWith(error);
	});

	it('captures key events with their properties', async () => {
		await track('bonus_points_gifted', { points: 5 });
		expect(posthog.capture).toHaveBeenLastCalledWith('bonus_points_gifted', {
			points: 5,
		});
	});
});
