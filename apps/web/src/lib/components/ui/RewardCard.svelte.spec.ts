import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import RewardCard from './RewardCard.svelte';

const base = {
	title: 'Pick Friday Movie',
	description: 'Choose the film.',
	cost: 80,
};

describe('RewardCard.svelte', () => {
	it('renders title, description and cost', async () => {
		render(RewardCard, { ...base, status: 'claimed' });
		await expect.element(page.getByText('Pick Friday Movie')).toBeVisible();
		await expect.element(page.getByText('Choose the film.')).toBeVisible();
		await expect.element(page.getByText('80 Points')).toBeVisible();
	});

	it('shows a Claimed pill and no button when claimed', async () => {
		render(RewardCard, { ...base, status: 'claimed' });
		await expect.element(page.getByText('Claimed')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('calls onclaim from the Claim button and has an orange border', async () => {
		const onclaim = vi.fn();
		render(RewardCard, { ...base, status: 'claimable', onclaim });
		await page.getByRole('button', { name: 'Claim' }).click();
		expect(onclaim).toHaveBeenCalledOnce();
		await expect
			.element(page.getByRole('article'))
			.toHaveClass('border-border-orange');
	});

	it('disables Claim when locked', async () => {
		render(RewardCard, base);
		await expect
			.element(page.getByRole('button', { name: 'Claim' }))
			.toBeDisabled();
	});

	it('lets the action snippet override the default', async () => {
		render(RewardCard, {
			...base,
			status: 'claimable',
			action: createRawSnippet(() => ({
				render: () => '<span>Custom</span>',
			})),
		});
		await expect.element(page.getByText('Custom')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});
});
