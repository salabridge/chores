import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SurfaceCard from './SurfaceCard.svelte';

const raw = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('SurfaceCard.svelte', () => {
	it('renders title, subtitle and body inside a labelled region', async () => {
		render(SurfaceCard, {
			title: 'Chore Status',
			subtitle: 'What needs attention.',
			children: raw('<p>Body</p>'),
		});
		await expect
			.element(page.getByRole('region', { name: 'Chore Status' }))
			.toBeVisible();
		await expect.element(page.getByText('What needs attention.')).toBeVisible();
		await expect.element(page.getByText('Body')).toBeVisible();
	});

	it('renders the trailing badge snippet', async () => {
		render(SurfaceCard, {
			title: 'T',
			badge: raw('<span>4 open items</span>'),
		});
		await expect.element(page.getByText('4 open items')).toBeVisible();
	});

	it('omits subtitle when not given', async () => {
		render(SurfaceCard, { title: 'Only title' });
		await expect
			.element(page.getByRole('heading', { name: 'Only title' }))
			.toBeVisible();
		expect(page.getByText('What needs attention.').elements()).toHaveLength(0);
	});
});
