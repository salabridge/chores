import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import StreakBanner from './StreakBanner.svelte';

describe('StreakBanner.svelte', () => {
	it('renders the title and message as a status', async () => {
		const children = createRawSnippet(() => ({
			render: () => '<span>Mia is catching up!</span>',
		}));
		render(StreakBanner, { title: '5-Day Active Streak!', children });
		await expect.element(page.getByRole('status')).toBeVisible();
		await expect.element(page.getByText('5-Day Active Streak!')).toBeVisible();
		await expect.element(page.getByText('Mia is catching up!')).toBeVisible();
	});

	it('shows a flame icon by default', async () => {
		render(StreakBanner, { title: 'S' });
		await expect.element(page.getByRole('status')).toBeVisible();
		expect(
			page.getByRole('status').element().querySelector('svg'),
		).not.toBeNull();
	});

	it('allows an icon override', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<span data-testid="custom">x</span>',
		}));
		render(StreakBanner, { title: 'S', icon });
		await expect.element(page.getByTestId('custom')).toBeVisible();
		expect(page.getByRole('status').element().querySelector('svg')).toBeNull();
	});
});
