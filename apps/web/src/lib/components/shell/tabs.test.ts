import { describe, expect, it } from 'vitest';
import { isTabActive, tabs, tabsFor } from './tabs.ts';

describe('tabs', () => {
	it('lists Today, Rewards and Streak in order', () => {
		expect(tabs.map((t) => t.href)).toEqual(['/today', '/rewards', '/streak']);
	});

	it('adds Overview and Account only for a parent', () => {
		expect(tabsFor(false).map((t) => t.href)).toEqual([
			'/today',
			'/rewards',
			'/streak',
		]);
		expect(tabsFor(true).map((t) => t.href)).toEqual([
			'/today',
			'/rewards',
			'/streak',
			'/overview',
			'/account',
		]);
	});

	it('matches a tab and the pages under it, not lookalike paths', () => {
		expect(isTabActive('/rewards', '/rewards')).toBe(true);
		expect(isTabActive('/rewards/history', '/rewards')).toBe(true);
		expect(isTabActive('/rewardsx', '/rewards')).toBe(false);
		expect(isTabActive('/chores/1', '/today')).toBe(false);
	});
});
