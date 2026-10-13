import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import HouseholdContribution from './HouseholdContribution.svelte';

const base = {
	loops: 6,
	streakDays: 3,
	points: 160,
	summary: '2 more loops unlock the next family reward.',
};

describe('HouseholdContribution.svelte', () => {
	it('shows the household and momentum tiles', async () => {
		render(HouseholdContribution, base);
		await expect.element(page.getByText('6 loops')).toBeVisible();
		await expect.element(page.getByText('completed together')).toBeVisible();
		await expect.element(page.getByText('3-day streak')).toBeVisible();
	});

	it('shows the summary line and points earned', async () => {
		render(HouseholdContribution, base);
		await expect
			.element(page.getByText('2 more loops unlock the next family reward.'))
			.toBeVisible();
		await expect.element(page.getByText('160 pts earned')).toBeVisible();
	});

	it('uses the singular for one loop', async () => {
		render(HouseholdContribution, { ...base, loops: 1 });
		await expect
			.element(page.getByText('1 loop', { exact: true }))
			.toBeVisible();
	});

	it('has the This Week badge', async () => {
		render(HouseholdContribution, base);
		await expect.element(page.getByText('This Week')).toBeVisible();
	});
});
