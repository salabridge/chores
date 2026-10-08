import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { overviewStats } from './fixtures.ts';
import OverviewStats from './OverviewStats.svelte';

describe('OverviewStats.svelte', () => {
	it('shows the four stat cards', async () => {
		render(OverviewStats, { stats: overviewStats });
		await expect.element(page.getByText('12 Chores')).toBeVisible();
		await expect.element(page.getByText('12 active')).toBeVisible();
		await expect
			.element(page.getByText('7 shared loops and 5 personal chores are live.'))
			.toBeVisible();
		await expect.element(page.getByText('4 Active')).toBeVisible();
		await expect.element(page.getByText('2 due soon')).toBeVisible();
		await expect
			.element(
				page.getByText(
					'Shared Bathroom Toilet and Run Dishwasher need attention next.',
				),
			)
			.toBeVisible();
		await expect.element(page.getByText('8 / 12')).toBeVisible();
		await expect.element(page.getByText('67% done')).toBeVisible();
		await expect
			.element(page.getByText('4 chores are still open.'))
			.toBeVisible();
		await expect.element(page.getByText('5 Days')).toBeVisible();
		await expect.element(page.getByText('1 exception')).toBeVisible();
		await expect
			.element(
				page.getByText('Mia is excluded from Run Dishwasher: too young.'),
			)
			.toBeVisible();
	});

	it('reads well when everything is caught up', async () => {
		render(OverviewStats, {
			stats: {
				...overviewStats,
				rotationsDueSoon: 0,
				dueSoonTitles: [],
				completedToday: 12,
				exceptions: 0,
				firstException: null,
			},
		});
		await expect
			.element(page.getByText('Every rotation is caught up for today.'))
			.toBeVisible();
		await expect
			.element(page.getByText('Everything due today is done.'))
			.toBeVisible();
		await expect.element(page.getByText('0 exceptions')).toBeVisible();
		await expect
			.element(page.getByText('No exclusion rules are active.'))
			.toBeVisible();
	});
});
