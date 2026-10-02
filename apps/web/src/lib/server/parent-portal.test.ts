import { isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberSummary, ProfileState } from './profile-state.ts';

const getProfileState = vi.fn();
const listParents = vi.fn();
vi.mock('./profiles.ts', () => ({ getProfileState, listParents }));

const { loadParentPortal: load } = await import('./parent-portal.ts');

const member = (o: Partial<MemberSummary>): MemberSummary => ({
	id: 'm',
	householdId: 'h1',
	userId: 'u1',
	role: 'parent',
	displayName: 'Mom',
	avatarColor: null,
	avatarInitial: null,
	...o,
});
const mom = member({ id: 'mom' });
const kid = member({
	id: 'kid',
	userId: null,
	role: 'kid',
	displayName: 'Mia',
});

const run = () => load();

async function redirectOf(): Promise<{ status: number; location: string }> {
	try {
		await run();
	} catch (e) {
		if (isRedirect(e)) return e;
	}
	throw new Error('expected a redirect');
}

beforeEach(() => {
	getProfileState.mockReset();
	listParents.mockReset();
});

describe('loadParentPortal', () => {
	it('returns the household parents for a parent in their own view', async () => {
		const state: ProfileState = { mode: 'self', member: mom, actor: mom };
		getProfileState.mockResolvedValue(state);
		listParents.mockResolvedValue([
			mom,
			member({ id: 'dad', displayName: 'Dad' }),
		]);
		await expect(run()).resolves.toEqual({
			parents: [
				{ id: 'mom', name: 'Mom' },
				{ id: 'dad', name: 'Dad' },
			],
		});
		expect(listParents).toHaveBeenCalledWith('h1');
	});

	it('redirects while a kid profile is active', async () => {
		getProfileState.mockResolvedValue({ mode: 'kid', member: kid, actor: mom });
		expect(await redirectOf()).toMatchObject({
			status: 303,
			location: '/today',
		});
		expect(listParents).not.toHaveBeenCalled();
	});

	it('redirects a member who is not a parent', async () => {
		const invited = member({ id: 'inv', role: 'kid', userId: 'u3' });
		getProfileState.mockResolvedValue({
			mode: 'self',
			member: invited,
			actor: invited,
		});
		expect(await redirectOf()).toMatchObject({
			status: 303,
			location: '/today',
		});
	});

	it('redirects someone who is not in a household', async () => {
		getProfileState.mockResolvedValue(null);
		expect(await redirectOf()).toMatchObject({
			status: 303,
			location: '/today',
		});
	});
});
