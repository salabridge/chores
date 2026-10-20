import type { CaptureResult } from 'posthog-js';
import { describe, expect, it, vi } from 'vitest';

// The SDK is mocked so the tests can tell whether it was ever loaded.
const posthog = vi.hoisted(() => ({
	loaded: false,
	init: vi.fn(),
	register: vi.fn(),
	capture: vi.fn(),
}));
vi.mock('posthog-js', () => {
	posthog.loaded = true;
	return { default: posthog };
});

const {
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
});

describe('posthogConfig', () => {
	it('sends through /ingest with replay off and no element text', () => {
		const config = posthogConfig('https://us.i.posthog.com');
		expect(config).toMatchObject({
			api_host: '/ingest',
			ui_host: 'https://us.posthog.com',
			person_profiles: 'identified_only',
			capture_pageview: false,
			disable_session_recording: true,
			mask_all_text: true,
			mask_all_element_attributes: true,
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

	it('captures key events with their properties', async () => {
		await track('bonus_points_gifted', { points: 5 });
		expect(posthog.capture).toHaveBeenLastCalledWith('bonus_points_gifted', {
			points: 5,
		});
	});
});
