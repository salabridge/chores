import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Logo from './Logo.svelte';

describe('Logo.svelte', () => {
	it('renders a home link with an accessible name by default', async () => {
		render(Logo);
		const link = page.getByRole('link', { name: 'ChoreLoop home' });
		await expect.element(link).toHaveAttribute('href', '/');
	});

	it('accepts a custom href', async () => {
		render(Logo, { href: '/app' });
		await expect
			.element(page.getByRole('link', { name: 'ChoreLoop home' }))
			.toHaveAttribute('href', '/app');
	});

	it('renders without a link when href is null', async () => {
		render(Logo, { href: null });
		await expect.element(page.getByText('ChoreLoop')).toBeInTheDocument();
		expect(page.getByRole('link').elements()).toHaveLength(0);
	});
});
