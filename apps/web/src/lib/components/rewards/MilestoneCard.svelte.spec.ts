import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MilestoneCard from './MilestoneCard.svelte';

const base = {
	title: 'Sundaes on Sunday',
	description: 'Ice cream night.',
	current: 140,
	needed: 150,
	note: '10 more points or 1 shared loop away.',
};

describe('MilestoneCard.svelte', () => {
	it('shows title, progress numbers and the note', async () => {
		render(MilestoneCard, { ...base, nextUp: true });
		await expect.element(page.getByText('Sundaes on Sunday')).toBeVisible();
		await expect.element(page.getByText('140 pts earned')).toBeVisible();
		await expect.element(page.getByText('150 pts needed')).toBeVisible();
		await expect
			.element(page.getByText('10 more points or 1 shared loop away.'))
			.toBeVisible();
	});

	it('exposes progress to assistive tech', async () => {
		render(MilestoneCard, { ...base, nextUp: true });
		const bar = page.getByRole('progressbar', {
			name: 'Sundaes on Sunday progress',
		});
		await expect.element(bar).toHaveAttribute('aria-valuenow', '140');
		await expect.element(bar).toHaveAttribute('aria-valuemax', '150');
	});

	it('marks the next milestone with a Next up pill', async () => {
		render(MilestoneCard, { ...base, nextUp: true });
		await expect.element(page.getByText('Next up')).toBeVisible();
	});

	it('shows Unlocked when reached, and no Next up', async () => {
		render(MilestoneCard, { ...base, current: 150, reached: true });
		await expect.element(page.getByText('Unlocked')).toBeVisible();
		expect(page.getByText('Next up').elements()).toHaveLength(0);
	});
});
