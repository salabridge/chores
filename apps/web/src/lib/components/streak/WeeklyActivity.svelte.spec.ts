import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { streakWeek } from './fixtures.ts';
import WeeklyActivity from './WeeklyActivity.svelte';

describe('WeeklyActivity.svelte', () => {
	it('shows the week, its number and the points', async () => {
		render(WeeklyActivity, { week: streakWeek });
		await expect.element(page.getByText('Oct 5–11')).toBeVisible();
		await expect.element(page.getByText('Week 41')).toBeVisible();
		await expect.element(page.getByText('85 pts')).toBeVisible();
		await expect
			.element(page.getByText('6 of 10 chores completed'))
			.toBeVisible();
	});

	it('marks each day as a streak day or not, for screen readers too', async () => {
		render(WeeklyActivity, { week: streakWeek });
		const items = page.getByRole('listitem').elements();
		expect(items).toHaveLength(7);
		expect(
			items.map((li) =>
				li.querySelector('[data-active]')?.getAttribute('data-active'),
			),
		).toEqual(['true', 'true', 'true', 'true', 'true', 'false', 'false']);
		await expect
			.element(page.getByText('Monday, Oct 5: streak day'))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Saturday, Oct 10: no streak'))
			.toBeInTheDocument();
	});

	it('reports progress through the week', async () => {
		render(WeeklyActivity, { week: streakWeek });
		const bar = page.getByRole('progressbar', {
			name: 'Chores completed this week',
		});
		await expect.element(bar).toHaveAttribute('aria-valuenow', '6');
		await expect.element(bar).toHaveAttribute('aria-valuemax', '10');
	});
});
