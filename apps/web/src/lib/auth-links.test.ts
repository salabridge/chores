import { describe, expect, it } from 'vitest';
import { safeRedirectTarget, withRedirect } from './auth-links.ts';

describe('withRedirect', () => {
	it('drops a redirect home and encodes anything else', () => {
		expect(withRedirect('/login', '/')).toBe('/login');
		expect(withRedirect('/signup', '/invite/abc_-1')).toBe(
			'/signup?redirectTo=%2Finvite%2Fabc_-1',
		);
	});
});

describe('safeRedirectTarget', () => {
	it('keeps same-origin paths, with their query and hash', () => {
		expect(safeRedirectTarget('/invite/abc_-1')).toBe('/invite/abc_-1');
		expect(safeRedirectTarget('/chores?tab=done#top')).toBe(
			'/chores?tab=done#top',
		);
	});

	it('sends anything that is not a path home', () => {
		expect(safeRedirectTarget(undefined)).toBe('/');
		expect(safeRedirectTarget('https://evil.example')).toBe('/');
		expect(safeRedirectTarget('evil.example')).toBe('/');
	});

	it('refuses targets a browser would resolve to another origin', () => {
		// `/%09/x` arrives decoded: tab, CR and LF are dropped by the browser.
		expect(safeRedirectTarget('/\t/evil.example')).toBe('/');
		expect(safeRedirectTarget('/\n/evil.example')).toBe('/');
		expect(safeRedirectTarget('/\r/evil.example')).toBe('/');
		expect(safeRedirectTarget('/\\evil.example')).toBe('/');
		expect(safeRedirectTarget('//evil.example')).toBe('/');
	});
});
