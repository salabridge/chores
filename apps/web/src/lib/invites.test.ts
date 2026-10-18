import { describe, expect, it } from 'vitest';
import {
	canManageInvite,
	inviteLink,
	isExpired,
	latestInviteBirthYear,
	parseInviteInput,
	UNDER_13_MESSAGE,
} from './invites.ts';

const YEAR = 2026;
const parse = (data: Parameters<typeof parseInviteInput>[0]) =>
	parseInviteInput(data, YEAR);

describe('parseInviteInput', () => {
	it('accepts a parent invite and ignores any birth year', () => {
		expect(
			parse({
				role: 'parent',
				email: ' sam@example.com ',
				displayName: ' Sam ',
				birthYear: '1990',
			}),
		).toEqual({
			ok: true,
			value: {
				role: 'parent',
				email: 'sam@example.com',
				displayName: 'Sam',
				birthYear: null,
			},
		});
	});

	it('leaves the name null when blank', () => {
		const parsed = parse({ role: 'parent', email: 'a@b.co', displayName: '' });
		expect(parsed.ok && parsed.value.displayName).toBeNull();
	});

	it('requires a known role and a valid email', () => {
		expect(parse({ role: 'owner', email: 'a@b.co' })).toMatchObject({
			ok: false,
		});
		expect(parse({ role: 'parent', email: '' })).toEqual({
			ok: false,
			message: 'Enter their email address.',
		});
		expect(parse({ role: 'parent', email: 'not an email' })).toEqual({
			ok: false,
			message: 'Enter a valid email address.',
		});
	});

	it('requires a birth year for kids', () => {
		expect(parse({ role: 'kid', email: 'ava@example.com' })).toEqual({
			ok: false,
			message: "Enter your kid's birth year.",
		});
	});

	it('accepts a kid born in or before current year - 14', () => {
		const parsed = parse({
			role: 'kid',
			email: 'ava@example.com',
			birthYear: String(YEAR - 14),
		});
		expect(parsed.ok && parsed.value.birthYear).toBe(YEAR - 14);
	});

	it('turns away a kid who may not be 13 yet, pointing at a managed profile', () => {
		for (const year of [YEAR - 13, YEAR - 5]) {
			expect(
				parse({
					role: 'kid',
					email: 'ava@example.com',
					birthYear: String(year),
				}),
			).toEqual({ ok: false, message: UNDER_13_MESSAGE });
		}
	});

	it('rejects birth years out of range', () => {
		expect(
			parse({ role: 'kid', email: 'ava@example.com', birthYear: '1800' }),
		).toMatchObject({ ok: false });
		expect(
			parse({ role: 'kid', email: 'ava@example.com', birthYear: 'abcd' }),
		).toMatchObject({ ok: false });
	});
});

describe('latestInviteBirthYear', () => {
	it('is 14 years back, so the kid is surely 13', () => {
		expect(latestInviteBirthYear(2026)).toBe(2012);
	});
});

describe('canManageInvite', () => {
	it('lets owners handle anyone and parents only kids', () => {
		expect(canManageInvite('owner', 'parent')).toBe(true);
		expect(canManageInvite('owner', 'kid')).toBe(true);
		expect(canManageInvite('parent', 'kid')).toBe(true);
		expect(canManageInvite('parent', 'parent')).toBe(false);
		expect(canManageInvite('kid', 'kid')).toBe(false);
	});
});

describe('isExpired', () => {
	it('is expired at or after expiresAt', () => {
		const expiresAt = new Date('2026-10-20T00:00:00Z');
		expect(isExpired({ expiresAt }, new Date('2026-10-19T23:59:59Z'))).toBe(
			false,
		);
		expect(isExpired({ expiresAt }, expiresAt)).toBe(true);
	});
});

describe('inviteLink', () => {
	it('points at the accept route', () => {
		expect(inviteLink('https://chores.example', 'abc')).toBe(
			'https://chores.example/invite/abc',
		);
	});
});
