import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { noStreak, streakData } from './fixtures.ts';
import StreakScreen from './StreakScreen.svelte';

describe('StreakScreen.svelte', () => {
	it('shows the heading, points and greeting', async () => {
		render(StreakScreen, { data: streakData });
		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Your Streak' }))
			.toBeVisible();
		await expect.element(page.getByText('140 pts')).toBeVisible();
		await expect
			.element(page.getByText('Keep your loop going, Leo!', { exact: false }))
			.toBeVisible();
	});

	it('shows the active streak, the week and the momentum card', async () => {
		render(StreakScreen, { data: streakData });
		await expect
			.element(page.getByRole('heading', { name: '5-Day Active Streak!' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Weekly activity' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Personal momentum' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Keep the streak warm' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Take Out Recycling' }))
			.toBeVisible();
	});

	it('invites a member with no streak to start one', async () => {
		render(StreakScreen, { data: noStreak });
		await expect
			.element(page.getByRole('heading', { name: 'Start a streak today!' }))
			.toBeVisible();
		await expect
			.element(page.getByText('Next up: 3 active days'))
			.toBeVisible();
	});
});
