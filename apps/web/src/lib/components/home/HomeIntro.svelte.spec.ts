import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import HomeIntro from './HomeIntro.svelte';

describe('HomeIntro.svelte', () => {
	it('has one h1 with the tagline', async () => {
		render(HomeIntro);
		const h1 = page.getByRole('heading', { level: 1 });
		await expect
			.element(h1)
			.toHaveTextContent(/Everyday chores\.\s*A shared routine\./);
		expect(h1.elements()).toHaveLength(1);
	});

	it('links Get started to /signup', async () => {
		render(HomeIntro);
		await expect
			.element(page.getByRole('link', { name: 'Get started' }))
			.toHaveAttribute('href', '/signup');
		await expect
			.element(page.getByText('New here? Start with your household.'))
			.toBeInTheDocument();
	});
});
