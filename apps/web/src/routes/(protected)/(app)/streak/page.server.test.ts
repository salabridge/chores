import { beforeEach, describe, expect, it, vi } from 'vitest';

// The streak rules are householdStreaks()'s (tested in @chore/db) and the
// shaping is ../streak.ts's; this checks the load reads the acting member's
// streak, never one from input.
const mocks = vi.hoisted(() => ({
	getProfileState: vi.fn(),
	loadStreakScreen: vi.fn(),
}));

vi.mock('#lib/server/profiles.js', () => ({
	getProfileState: mocks.getProfileState,
}));
vi.mock('#lib/server/streak.js', () => ({
	loadStreakScreen: mocks.loadStreakScreen,
}));

const { load } = await import('./+page.server.ts');

beforeEach(() => vi.resetAllMocks());

describe('streak load', () => {
	it('loads the streak screen for the acting member', async () => {
		const member = { id: 'kid1', householdId: 'h1', displayName: 'Leo' };
		const streak = { name: 'Leo' };
		mocks.getProfileState.mockResolvedValue({ member });
		mocks.loadStreakScreen.mockResolvedValue(streak);
		await expect(load({} as never)).resolves.toEqual({ streak });
		expect(mocks.loadStreakScreen).toHaveBeenCalledWith(member);
	});

	it('returns no streak without a household', async () => {
		mocks.getProfileState.mockResolvedValue(null);
		await expect(load({} as never)).resolves.toEqual({ streak: null });
		expect(mocks.loadStreakScreen).not.toHaveBeenCalled();
	});
});
