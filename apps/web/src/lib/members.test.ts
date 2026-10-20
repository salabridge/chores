import { describe, expect, it } from 'vitest';
import {
	canEditMemberAvatar,
	canRemoveMember,
	memberLabel,
	pointsMoveTargets,
	sortMembers,
} from './members.ts';

describe('canEditMemberAvatar', () => {
	const owner = { id: 'o1', role: 'owner' as const };
	const parent = { id: 'p1', role: 'parent' as const };
	const kid = { id: 'k1', role: 'kid' as const };

	it('lets an owner change anyone', () => {
		expect(canEditMemberAvatar(owner, owner)).toBe(true);
		expect(canEditMemberAvatar(owner, parent)).toBe(true);
		expect(canEditMemberAvatar(owner, kid)).toBe(true);
	});

	it('lets a parent change kids and themselves, not the owner or another parent', () => {
		expect(canEditMemberAvatar(parent, kid)).toBe(true);
		expect(canEditMemberAvatar(parent, parent)).toBe(true);
		expect(canEditMemberAvatar(parent, owner)).toBe(false);
		expect(canEditMemberAvatar(parent, { id: 'p2', role: 'parent' })).toBe(
			false,
		);
	});

	it('never lets a kid change anyone', () => {
		expect(canEditMemberAvatar(kid, kid)).toBe(false);
		expect(canEditMemberAvatar(kid, { id: 'k2', role: 'kid' })).toBe(false);
	});
});

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

describe('canRemoveMember', () => {
	const owner = { id: 'o1', role: 'owner' as const };
	const parent = { id: 'p1', role: 'parent' as const };
	const kid = { id: 'k1', role: 'kid' as const };

	it('lets an owner remove anyone but themselves', () => {
		expect(canRemoveMember(owner, kid)).toBe(true);
		expect(canRemoveMember(owner, parent)).toBe(true);
		expect(canRemoveMember(owner, { id: 'o2', role: 'owner' })).toBe(true);
		expect(canRemoveMember(owner, owner)).toBe(false);
	});

	it('lets a parent remove kids only', () => {
		expect(canRemoveMember(parent, kid)).toBe(true);
		expect(canRemoveMember(parent, owner)).toBe(false);
		expect(canRemoveMember(parent, { id: 'p2', role: 'parent' })).toBe(false);
		expect(canRemoveMember(parent, parent)).toBe(false);
	});

	it('never lets a kid remove anyone', () => {
		expect(canRemoveMember(kid, { id: 'k2', role: 'kid' })).toBe(false);
	});
});

describe('pointsMoveTargets', () => {
	const members = [
		{ id: 'o1', role: 'owner' as const },
		{ id: 'k1', role: 'kid' as const },
		{ id: 'k2', role: 'kid' as const },
		{ id: 'k3', role: 'kid' as const },
	];

	it('offers every other kid for a kid', () => {
		expect(pointsMoveTargets(members, members[1]).map((m) => m.id)).toEqual([
			'k2',
			'k3',
		]);
	});

	it('offers nobody for a parent', () => {
		expect(pointsMoveTargets(members, members[0])).toEqual([]);
	});
});
