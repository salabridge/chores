import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import HomeFooter from './HomeFooter.svelte';

describe('HomeFooter.svelte', () => {
	it('is a contentinfo landmark with a sign in link to /login', async () => {
		render(HomeFooter);
		await expect.element(page.getByRole('contentinfo')).toBeInTheDocument();
		await expect
			.element(
				page.getByRole('heading', {
					level: 2,
					name: 'Already part of a household?',
				}),
			)
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Sign in' }))
			.toHaveAttribute('href', '/login');
		await expect
			.element(page.getByText('ChoreLoop · A little help around the house.'))
			.toBeInTheDocument();
	});
});
