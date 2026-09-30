import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SocialSignIn from './SocialSignIn.svelte';

describe('SocialSignIn.svelte', () => {
	it('renders a labelled group with the divider text and no heading', async () => {
		render(SocialSignIn);

		await expect
			.element(
				page.getByRole('group', { name: 'Sign in with a social account' }),
			)
			.toBeInTheDocument();
		await expect
			.element(page.getByText('or continue with'))
			.toBeInTheDocument();
		await expect.element(page.getByRole('heading')).not.toBeInTheDocument();
	});

	it('calls onchoose with the chosen provider', async () => {
		const onchoose = vi.fn();
		render(SocialSignIn, { onchoose });

		await page.getByRole('button', { name: 'Google' }).click();
		await page.getByRole('button', { name: 'Apple' }).click();

		expect(onchoose).toHaveBeenNthCalledWith(1, 'google');
		expect(onchoose).toHaveBeenNthCalledWith(2, 'apple');
	});

	it('defaults to non-submitting buttons', async () => {
		render(SocialSignIn);

		await expect
			.element(page.getByRole('button', { name: 'Google' }))
			.toHaveAttribute('type', 'button');
	});
});
