import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { emptyToday, todayData } from './fixtures.ts';
import TodayScreen from './TodayScreen.svelte';

describe('TodayScreen.svelte', () => {
	it('shows the greeting, points and streak', async () => {
		render(TodayScreen, { data: todayData });
		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Today' }))
			.toBeVisible();
		await expect.element(page.getByText('Hey Leo!')).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Hey Leo!' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByText('Ready to spin the loop?'))
			.toBeVisible();
		await expect.element(page.getByText('140 pts')).toBeVisible();
		await expect.element(page.getByText('5-Day Active Streak!')).toBeVisible();
	});

	it('shows the summary tiles', async () => {
		render(TodayScreen, { data: todayData });
		await expect.element(page.getByText('2 chores')).toBeVisible();
		await expect.element(page.getByText('25 pts total')).toBeVisible();
		await expect.element(page.getByText('3 loops')).toBeVisible();
		await expect.element(page.getByText('20 pts available')).toBeVisible();
	});

	it("shows the week's progress", async () => {
		render(TodayScreen, { data: todayData });
		await expect
			.element(page.getByRole('region', { name: 'Weekly Progress' }))
			.toBeVisible();
		await expect.element(page.getByText('6 of 10 completed')).toBeVisible();
		await expect.element(page.getByText('Week 41')).toBeVisible();
		await expect.element(page.getByText('85 pts')).toBeVisible();
	});

	it('links the priority callout to the loop', async () => {
		render(TodayScreen, { data: todayData });
		const callout = page.getByRole('link', { name: /Priority loop first/ });
		await expect.element(callout).toHaveAttribute('href', '/chores/toilet');
		await expect
			.element(callout)
			.toHaveTextContent('Clean Bathroom Toilet is active now');
	});

	it('lists chores in sort order, linking to their detail page', async () => {
		render(TodayScreen, { data: todayData });
		const hrefs = page
			.getByRole('link')
			.elements()
			.map((l) => l.getAttribute('href'));
		expect(hrefs).toEqual([
			// The priority callout, then the cards.
			'/chores/toilet',
			'/chores/room',
			'/chores/recycling',
			'/chores/toilet',
			'/chores/dishes',
			'/chores/dog',
		]);
	});

	it('says who has the turn and who completed a rotation', async () => {
		render(TodayScreen, { data: todayData });
		await expect
			.element(page.getByText('Shared rotation • Mia has the turn'))
			.toBeVisible();
		await expect
			.element(page.getByText('Shared rotation • Completed by Mia'))
			.toBeVisible();
	});

	it('shows simple empty states', async () => {
		render(TodayScreen, { data: emptyToday });
		await expect
			.element(page.getByText('Nothing personal on your list today.'))
			.toBeVisible();
		await expect
			.element(
				page.getByText("You aren't part of any household rotations today."),
			)
			.toBeVisible();
		await expect.element(page.getByText('Start a streak today!')).toBeVisible();
		await expect
			.element(page.getByText('Priority loop first'))
			.not.toBeInTheDocument();
	});
});
