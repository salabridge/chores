import { beforeEach, describe, expect, it, vi } from 'vitest';

// Checks the shell reads the acting member's own name and balance, and the
// kid-mode bar's PIN state only in kid mode.
const mocks = vi.hoisted(() => ({
	getProfileState: vi.fn(),
	memberPointsBalance: vi.fn(),
	pinGet: vi.fn(),
}));

vi.mock('#lib/server/profiles.js', () => ({
	getProfileState: mocks.getProfileState,
}));
vi.mock('#lib/server/member-stats.js', () => ({
	memberPointsBalance: mocks.memberPointsBalance,
}));
vi.mock('#lib/server/pin-store.js', () => ({
	pinStore: { get: mocks.pinGet },
}));

const { load } = await import('./+layout.server.ts');

beforeEach(() => vi.resetAllMocks());

const leo = {
	id: 'kid1',
	householdId: 'h1',
	role: 'kid',
	displayName: 'Leo',
	avatarColor: 'green',
};

describe('member shell load', () => {
	it("gives the header the acting member's name and balance", async () => {
		mocks.getProfileState.mockResolvedValue({ mode: 'self', member: leo });
		mocks.memberPointsBalance.mockResolvedValue(140);
		await expect(load({} as never)).resolves.toEqual({
			isParent: false,
			activeKid: null,
			shellMember: { name: 'Leo', points: 140, tone: 'green' },
		});
		expect(mocks.memberPointsBalance).toHaveBeenCalledWith('kid1');
		expect(mocks.pinGet).not.toHaveBeenCalled();
	});

	it('gives a parent acting as themselves the parent tabs', async () => {
		const mom = { ...leo, id: 'parent1', displayName: 'Mom', role: 'owner' };
		mocks.getProfileState.mockResolvedValue({
			mode: 'self',
			member: mom,
			actor: mom,
		});
		mocks.memberPointsBalance.mockResolvedValue(0);
		await expect(load({} as never)).resolves.toMatchObject({ isParent: true });
	});

	it('reads the parent PIN state in kid mode', async () => {
		mocks.getProfileState.mockResolvedValue({
			mode: 'kid',
			member: leo,
			actor: { id: 'parent1' },
		});
		mocks.memberPointsBalance.mockResolvedValue(15);
		mocks.pinGet.mockResolvedValue({ lockedAt: new Date() });
		await expect(load({} as never)).resolves.toEqual({
			isParent: false,
			activeKid: { id: 'kid1', name: 'Leo', pinLocked: true },
			shellMember: { name: 'Leo', points: 15, tone: 'green' },
		});
		expect(mocks.pinGet).toHaveBeenCalledWith('parent1');
	});

	it('has no header member without a household', async () => {
		mocks.getProfileState.mockResolvedValue(null);
		await expect(load({} as never)).resolves.toEqual({
			isParent: false,
			activeKid: null,
			shellMember: null,
		});
		expect(mocks.memberPointsBalance).not.toHaveBeenCalled();
	});
});
