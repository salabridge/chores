import { describe, expect, it } from 'vitest';
import { isTabActive, tabs } from './tabs.ts';

describe('tabs', () => {
	it('lists Today, Rewards and Streak in order', () => {
		expect(tabs.map((t) => t.href)).toEqual(['/today', '/rewards', '/streak']);
	});

	it('matches a tab and the pages under it, not lookalike paths', () => {
		expect(isTabActive('/rewards', '/rewards')).toBe(true);
		expect(isTabActive('/rewards/history', '/rewards')).toBe(true);
		expect(isTabActive('/rewardsx', '/rewards')).toBe(false);
		expect(isTabActive('/chores/1', '/today')).toBe(false);
	});
});
