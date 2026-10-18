import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import WeeklyProgressCard from './WeeklyProgressCard.svelte';

const week = { label: 'Oct 5–11', number: 41, done: 6, due: 10, points: 85 };

describe('WeeklyProgressCard.svelte', () => {
	it('names the week and shows progress and points', async () => {
		render(WeeklyProgressCard, week);
		await expect
			.element(page.getByRole('region', { name: 'Weekly Progress' }))
			.toBeVisible();
		await expect.element(page.getByText('Oct 5–11')).toBeVisible();
		await expect.element(page.getByText('Week 41')).toBeVisible();
		await expect.element(page.getByText('6 of 10 completed')).toBeVisible();
		await expect.element(page.getByText('60%')).toBeVisible();
		await expect.element(page.getByText('85 pts')).toBeVisible();
		await expect
			.element(
				page.getByRole('progressbar', { name: 'Chores completed this week' }),
			)
			.toHaveAttribute('aria-valuenow', '6');
	});

	it('says nothing is due instead of showing 0 of 0', async () => {
		render(WeeklyProgressCard, { ...week, done: 0, due: 0 });
		await expect
			.element(page.getByText('Nothing due yet this week.'))
			.toBeVisible();
		await expect.element(page.getByText(/completed/)).not.toBeInTheDocument();
		await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
	});

	it('never shows more than 100% when extra chores were done', async () => {
		render(WeeklyProgressCard, { ...week, done: 7, due: 5 });
		await expect.element(page.getByText('5 of 5 completed')).toBeVisible();
		await expect.element(page.getByText('100%')).toBeVisible();
	});
});
