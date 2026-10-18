import { describe, expect, it } from 'vitest';
import { withRedirect } from './auth-links.ts';

describe('withRedirect', () => {
	it('drops a redirect home and encodes anything else', () => {
		expect(withRedirect('/login', '/')).toBe('/login');
		expect(withRedirect('/signup', '/invite/abc_-1')).toBe(
			'/signup?redirectTo=%2Finvite%2Fabc_-1',
		);
	});
});
