import { describe, expect, it } from 'vitest';
import {
	effectiveLandingRoute,
	isLandingRoute,
	landingTarget,
	resolveLandingPath,
} from './landing.ts';

const parent = { needsSetup: false, mode: 'self', role: 'owner' } as const;

describe('effectiveLandingRoute', () => {
	it('prefers the device, then the user default, then Today', () => {
		expect(effectiveLandingRoute('overview', 'today')).toBe('overview');
		expect(effectiveLandingRoute(null, 'overview')).toBe('overview');
		expect(effectiveLandingRoute(null, null)).toBe('today');
		expect(effectiveLandingRoute(undefined, undefined)).toBe('today');
	});
});

describe('resolveLandingPath', () => {
	it('sends a parent to Today with nothing set', () => {
		expect(resolveLandingPath(parent)).toBe('/today');
	});

	it('sends a parent to the dashboard when the device says so', () => {
		expect(resolveLandingPath({ ...parent, deviceRoute: 'overview' })).toBe(
			'/overview',
		);
	});

	it('falls back to the per-user default, and the device wins over it', () => {
		expect(resolveLandingPath({ ...parent, userDefault: 'overview' })).toBe(
			'/overview',
		);
		expect(
			resolveLandingPath({
				...parent,
				deviceRoute: 'today',
				userDefault: 'overview',
			}),
		).toBe('/today');
	});

	it('treats a plain parent like an owner', () => {
		expect(
			resolveLandingPath({
				...parent,
				role: 'parent',
				deviceRoute: 'overview',
			}),
		).toBe('/overview');
	});

	it('sends a kid profile to Today even when the dashboard is preferred', () => {
		expect(
			resolveLandingPath({ ...parent, mode: 'kid', deviceRoute: 'overview' }),
		).toBe('/today');
	});

	it('sends a non-parent to Today even when the dashboard is preferred', () => {
		expect(
			resolveLandingPath({ ...parent, role: 'kid', userDefault: 'overview' }),
		).toBe('/today');
	});

	it('sends anyone who needs setup to /setup regardless of the preference', () => {
		expect(
			resolveLandingPath({
				needsSetup: true,
				mode: null,
				role: null,
				deviceRoute: 'overview',
				userDefault: 'overview',
			}),
		).toBe('/setup');
	});

	it('falls back to Today with no household and no setup needed', () => {
		expect(
			resolveLandingPath({ needsSetup: false, mode: null, role: null }),
		).toBe('/today');
	});
});

describe('landingTarget', () => {
	it('uses the landing path when there is no explicit target', () => {
		expect(landingTarget('/', '/overview')).toBe('/overview');
	});

	it('lets an explicit safe redirect win', () => {
		expect(landingTarget('/chores/new', '/overview')).toBe('/chores/new');
		expect(landingTarget('/today', '/overview')).toBe('/today');
	});
});

describe('isLandingRoute', () => {
	it('only accepts the enum values', () => {
		expect(isLandingRoute('today')).toBe(true);
		expect(isLandingRoute('overview')).toBe(true);
		expect(isLandingRoute('/overview')).toBe(false);
		expect(isLandingRoute('https://evil.example')).toBe(false);
		expect(isLandingRoute(undefined)).toBe(false);
	});
});
