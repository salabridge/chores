import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { upcomingRotations } from './fixtures.ts';
import UpcomingRotationsPanel from './UpcomingRotationsPanel.svelte';

describe('UpcomingRotationsPanel.svelte', () => {
	it('shows handoff, order chain and a View Loop link per rotation', async () => {
		render(UpcomingRotationsPanel, {
			rotations: upcomingRotations,
			loopHref: '/loops',
		});
		await expect.element(page.getByText('2 due today')).toBeVisible();
		await expect
			.element(page.getByText('Next handoff at 8:00 PM'))
			.toBeVisible();
		await expect.element(page.getByText('Next handoff tomorrow')).toBeVisible();
		expect(
			page.getByText('Loop Reset', { exact: true }).elements(),
		).toHaveLength(3);
		const link = page.getByRole('link', {
			name: 'View Loop: Run Dishwasher',
		});
		await expect
			.element(link)
			.toHaveAttribute('href', '/loops#loop-dishwasher');
	});

	it('has an empty state', async () => {
		render(UpcomingRotationsPanel, { rotations: [] });
		await expect.element(page.getByText('0 due today')).toBeVisible();
		await expect
			.element(page.getByText(/No active rotations yet/))
			.toBeVisible();
	});
});
