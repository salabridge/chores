import { describe, expect, it } from 'vitest';
import { memberLabel, sortMembers } from './members.ts';

describe('memberLabel', () => {
	it('names each role, and tells managed kids from kids with a login', () => {
		expect(memberLabel({ role: 'owner', managed: false })).toBe('Owner');
		expect(memberLabel({ role: 'parent', managed: false })).toBe('Parent');
		expect(memberLabel({ role: 'kid', managed: true })).toBe('Managed kid');
		expect(memberLabel({ role: 'kid', managed: false })).toBe(
			'Kid with own login',
		);
	});
});

describe('sortMembers', () => {
	it('puts owners, then parents, then kids, keeping order within a role', () => {
		const sorted = sortMembers([
			{ id: 'k1', role: 'kid' as const },
			{ id: 'p1', role: 'parent' as const },
			{ id: 'k2', role: 'kid' as const },
			{ id: 'o1', role: 'owner' as const },
			{ id: 'p2', role: 'parent' as const },
		]);
		expect(sorted.map((m) => m.id)).toEqual(['o1', 'p1', 'p2', 'k1', 'k2']);
	});
});
