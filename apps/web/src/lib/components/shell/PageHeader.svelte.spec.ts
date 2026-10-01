import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PageHeader from './PageHeader.svelte';

describe('PageHeader.svelte', () => {
	it('renders the label as a heading and a back link', async () => {
		render(PageHeader, { label: 'Personal Chore' });
		await expect
			.element(page.getByRole('heading', { name: 'Personal Chore' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: /Back/ }))
			.toHaveAttribute('href', '/today');
	});

	it('accepts a custom backHref', async () => {
		render(PageHeader, { label: 'Rotation Loop', backHref: '/streak' });
		await expect
			.element(page.getByRole('link', { name: /Back/ }))
			.toHaveAttribute('href', '/streak');
	});
});
