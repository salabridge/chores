import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ClaimConfirm from './ClaimConfirm.svelte';

const base = {
	title: 'Pick Friday Movie',
	cost: 80,
	balance: 140,
	cancelHref: '/rewards',
};

describe('ClaimConfirm.svelte', () => {
	it('says what is spent and what is left', async () => {
		render(ClaimConfirm, base);
		await expect
			.element(page.getByRole('heading', { name: 'Claim Pick Friday Movie?' }))
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					'This spends 80 points. You have 140 now and will have 60 left.',
				),
			)
			.toBeVisible();
	});

	it('has a submit button and a Cancel link', async () => {
		render(ClaimConfirm, base);
		await expect
			.element(page.getByRole('button', { name: 'Spend 80 points' }))
			.toHaveAttribute('type', 'submit');
		await expect
			.element(page.getByRole('link', { name: 'Cancel' }))
			.toHaveAttribute('href', '/rewards');
	});

	it('disables the button while pending', async () => {
		render(ClaimConfirm, { ...base, pending: true });
		await expect
			.element(page.getByRole('button', { name: 'Claiming…' }))
			.toBeDisabled();
	});

	it('renders the hidden inputs it is given', async () => {
		const { container } = render(ClaimConfirm, {
			...base,
			children: createRawSnippet(() => ({
				render: () => '<input type="hidden" name="rewardId" value="r1">',
			})),
		});
		expect(container.querySelector('input[name="rewardId"]')).not.toBeNull();
	});
});
