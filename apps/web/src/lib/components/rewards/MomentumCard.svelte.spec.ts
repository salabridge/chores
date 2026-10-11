import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MomentumCard from './MomentumCard.svelte';

const base = {
	days: 3,
	goal: 4,
	loopsLeft: 1,
	percent: 75,
	message: 'One more loop.',
	chores: [
		{ id: 'a', title: 'Recycling', href: '/chores/a' },
		{ id: 'b', title: 'Room reset', href: '/chores/b' },
	],
};

describe('MomentumCard.svelte', () => {
	it('shows the streak, goal and loops left', async () => {
		render(MomentumCard, base);
		await expect.element(page.getByText('3 days')).toBeVisible();
		await expect.element(page.getByText('1 loop left')).toBeVisible();
		await expect.element(page.getByText('4-day streak')).toBeVisible();
		await expect.element(page.getByText('One more loop.')).toBeVisible();
	});

	it('reports progress on the bar', async () => {
		render(MomentumCard, base);
		const bar = page.getByRole('progressbar', { name: 'Streak progress' });
		await expect.element(bar).toHaveAttribute('aria-valuenow', '75');
	});

	it('links each suggested chore to its screen', async () => {
		render(MomentumCard, base);
		await expect
			.element(page.getByRole('link', { name: 'Recycling' }))
			.toHaveAttribute('href', '/chores/a');
		await expect
			.element(page.getByRole('link', { name: 'Room reset' }))
			.toHaveAttribute('href', '/chores/b');
	});

	it('leaves the chips out when there are none', async () => {
		render(MomentumCard, { ...base, chores: [] });
		expect(page.getByRole('link').elements()).toHaveLength(0);
	});

	it('uses the singular for a one-day streak', async () => {
		render(MomentumCard, { ...base, days: 1 });
		await expect
			.element(page.getByText('1 day', { exact: true }))
			.toBeVisible();
	});
});
