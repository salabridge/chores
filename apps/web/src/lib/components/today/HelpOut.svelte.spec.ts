import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { helpOutToday } from './fixtures.ts';
import HelpOut from './HelpOut.svelte';

describe('HelpOut.svelte', () => {
	it('starts collapsed with a count', async () => {
		render(HelpOut, { items: helpOutToday.helpOut });
		await expect
			.element(page.getByTestId('help-out'))
			.not.toHaveAttribute('open');
		await expect
			.element(page.getByText(/2 open chores from others/))
			.toBeVisible();
		expect(page.getByRole('link').elements()).toHaveLength(0);
	});

	it("lists other members' chores once opened, each linking to its chore", async () => {
		render(HelpOut, { items: helpOutToday.helpOut });
		await page.getByText('Help out').click();
		const links = page.getByRole('link').elements();
		// Overdue first, then by owner.
		expect(links.map((a) => a.getAttribute('href'))).toEqual([
			'/chores/dad-gutters',
			'/chores/mia-trash',
		]);
		await expect.element(page.getByText(/Mia's chore/)).toBeVisible();
		await expect.element(page.getByText(/Dad's chore/)).toBeVisible();
	});

	it('can start open', async () => {
		render(HelpOut, { items: helpOutToday.helpOut, open: true });
		await expect
			.element(page.getByRole('link', { name: /Take Out the Trash/ }))
			.toBeVisible();
	});

	it('renders nothing without chores', async () => {
		render(HelpOut, { items: [] });
		expect(page.getByTestId('help-out').elements()).toHaveLength(0);
	});
});
