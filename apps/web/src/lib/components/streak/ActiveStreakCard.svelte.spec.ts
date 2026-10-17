import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ActiveStreakCard from './ActiveStreakCard.svelte';

describe('ActiveStreakCard.svelte', () => {
	it('shows the streak, the note and the next goal', async () => {
		render(ActiveStreakCard, {
			days: 5,
			goal: 7,
			note: 'Mia is catching up!',
		});
		await expect
			.element(page.getByRole('region', { name: '5-Day Active Streak!' }))
			.toBeVisible();
		await expect.element(page.getByText('Mia is catching up!')).toBeVisible();
		await expect
			.element(page.getByText('Next up: 7 active days'))
			.toBeVisible();
		await expect.element(page.getByText('2 more days')).toBeVisible();
	});

	it('mentions exceptions inside the streak', async () => {
		render(ActiveStreakCard, { days: 12, goal: 14, exceptions: 1 });
		await expect
			.element(page.getByText('Includes 1 exception.', { exact: false }))
			.toBeVisible();
	});

	it('leaves the note out when there is none', async () => {
		render(ActiveStreakCard, { days: 0, goal: 3 });
		await expect
			.element(page.getByRole('heading', { name: 'Start a streak today!' }))
			.toBeVisible();
		await expect.element(page.getByText('catching up')).not.toBeInTheDocument();
	});
});
