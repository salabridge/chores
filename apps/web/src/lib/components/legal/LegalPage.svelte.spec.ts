import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import LegalPage from './LegalPage.host.svelte';

describe('LegalPage.svelte', () => {
	it('shows the title, last updated date and body', async () => {
		render(LegalPage, {
			title: 'Privacy Policy',
			lastUpdated: '30 October 2026',
		});
		await expect
			.element(page.getByRole('heading', { level: 1, name: 'Privacy Policy' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Last updated: 30 October 2026'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'Section' }))
			.toBeInTheDocument();
	});

	it('links to both legal pages from the footer', async () => {
		render(LegalPage, { title: 'Terms of Service', lastUpdated: 'today' });
		const nav = page.getByRole('navigation', { name: 'Legal' });
		await expect
			.element(nav.getByRole('link', { name: 'Privacy Policy' }))
			.toHaveAttribute('href', '/privacy');
		await expect
			.element(nav.getByRole('link', { name: 'Terms of Service' }))
			.toHaveAttribute('href', '/terms');
	});
});
