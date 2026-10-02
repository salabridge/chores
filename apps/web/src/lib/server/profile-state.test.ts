import { describe, expect, it } from 'vitest';
import {
	canOpenKidProfile,
	type MemberSummary,
	parentGuard,
	resolveProfile,
} from './profile-state.ts';

const member = (overrides: Partial<MemberSummary>): MemberSummary => ({
	id: 'm',
	householdId: 'h1',
	userId: null,
	role: 'kid',
	displayName: 'Member',
	avatarColor: null,
	avatarInitial: null,
	...overrides,
});

const parent = member({ id: 'parent', userId: 'u1', role: 'parent' });
const owner = member({ id: 'owner', userId: 'u2', role: 'owner' });
const kid = member({ id: 'kid', displayName: 'Leo' });
const otherHouseholdKid = member({ id: 'kid-2', householdId: 'h2' });
const invitedKid = member({ id: 'invited', userId: 'u3' });

describe('canOpenKidProfile', () => {
	it('lets a parent or owner open a managed kid in their household', () => {
		expect(canOpenKidProfile(parent, kid)).toBe(true);
		expect(canOpenKidProfile(owner, kid)).toBe(true);
	});

	it('rejects kids in another household', () => {
		expect(canOpenKidProfile(parent, otherHouseholdKid)).toBe(false);
	});

	it('rejects kids with their own login, other parents, and non-parent actors', () => {
		expect(canOpenKidProfile(parent, invitedKid)).toBe(false);
		expect(canOpenKidProfile(owner, parent)).toBe(false);
		expect(canOpenKidProfile(invitedKid, kid)).toBe(false);
	});
});

describe('resolveProfile', () => {
	it('is null for someone not in a household', () => {
		expect(resolveProfile([], null)).toBeNull();
	});

	it('acts as the user themselves with no remembered kid', () => {
		expect(resolveProfile([parent], null)).toEqual({
			mode: 'self',
			member: parent,
			actor: parent,
		});
	});

	it('acts as the remembered managed kid, keeping the parent as actor', () => {
		expect(resolveProfile([parent], kid)).toEqual({
			mode: 'kid',
			member: kid,
			actor: parent,
		});
	});

	it('ignores a remembered member the user may not open', () => {
		for (const stale of [otherHouseholdKid, invitedKid, parent]) {
			expect(resolveProfile([parent], stale)?.mode).toBe('self');
		}
	});

	it('never lets an invited kid act as a managed kid', () => {
		expect(resolveProfile([invitedKid], kid)).toEqual({
			mode: 'self',
			member: invitedKid,
			actor: invitedKid,
		});
	});
});

describe('parentGuard', () => {
	it('allows a parent in their own view', () => {
		expect(parentGuard(resolveProfile([parent], null))).toBe('allow');
	});

	it('rejects a parent session while a kid profile is active', () => {
		expect(parentGuard(resolveProfile([parent], kid))).toBe(
			'kid-profile-active',
		);
	});

	it('rejects invited kids, and allows setup pages before a household exists', () => {
		expect(parentGuard(resolveProfile([invitedKid], null))).toBe(
			'not-a-parent',
		);
		expect(parentGuard(null)).toBe('allow');
	});
});
