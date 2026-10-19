import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SiteHeader from './SiteHeader.svelte';

describe('SiteHeader.svelte', () => {
	it('renders a banner with the logo and a sign in link to /login', async () => {
		render(SiteHeader);
		await expect.element(page.getByRole('banner')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'ChoreLoop home' }))
			.toHaveAttribute('href', '/');
		await expect
			.element(page.getByRole('link', { name: 'Sign in' }))
			.toHaveAttribute('href', '/login');
	});
});
