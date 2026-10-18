import { describe, expect, it } from 'vitest';
import { signedInProblem } from './invite-accept.ts';

const invite = { email: 'Ava@Example.com' };

describe('signedInProblem', () => {
	it('lets a verified user with the invited email accept, ignoring case', () => {
		expect(
			signedInProblem(invite, {
				email: 'ava@example.com',
				emailVerified: true,
			}),
		).toBeNull();
	});

	it('flags a different email before an unverified one', () => {
		expect(
			signedInProblem(invite, {
				email: 'jim@example.com',
				emailVerified: false,
			}),
		).toBe('wrong-email');
		expect(
			signedInProblem(invite, {
				email: 'ava@example.com',
				emailVerified: false,
			}),
		).toBe('unverified');
	});
});
