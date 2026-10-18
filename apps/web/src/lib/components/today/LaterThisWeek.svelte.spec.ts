import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { weeklyDueToday } from './fixtures.ts';
import LaterThisWeek from './LaterThisWeek.svelte';

describe('LaterThisWeek.svelte', () => {
	it('starts collapsed with a count', async () => {
		render(LaterThisWeek, { items: weeklyDueToday.later });
		await expect
			.element(page.getByTestId('later-this-week'))
			.not.toHaveAttribute('open');
		await expect
			.element(page.getByText('2 weekly chores due on a later day'))
			.toBeVisible();
		// Closed <details> content is hidden, so nothing in it is reachable.
		expect(page.getByRole('link').elements()).toHaveLength(0);
	});

	it('lists the chores by day once opened, each linking to its chore', async () => {
		render(LaterThisWeek, { items: weeklyDueToday.later });
		await page.getByText('Later this week').click();
		const links = page.getByRole('link').elements();
		expect(links.map((a) => a.getAttribute('href'))).toEqual([
			'/chores/car',
			'/chores/lawn',
		]);
		await expect
			.element(page.getByText('Due Sat · before lunch'))
			.toBeVisible();
		await expect.element(page.getByText('20 pts')).toBeVisible();
	});

	it('can start open', async () => {
		render(LaterThisWeek, { items: weeklyDueToday.later, open: true });
		await expect
			.element(page.getByRole('link', { name: /Mow the Lawn/ }))
			.toBeVisible();
	});

	it('renders nothing without chores', async () => {
		render(LaterThisWeek, { items: [] });
		expect(page.getByTestId('later-this-week').elements()).toHaveLength(0);
	});
});
