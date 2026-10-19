import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import HomePage from './HomePage.svelte';

describe('HomePage.svelte', () => {
	it('has header, main and footer landmarks and exactly one h1', async () => {
		render(HomePage);
		await expect.element(page.getByRole('banner')).toBeInTheDocument();
		await expect.element(page.getByRole('main')).toBeInTheDocument();
		await expect.element(page.getByRole('contentinfo')).toBeInTheDocument();
		expect(page.getByRole('heading', { level: 1 }).elements()).toHaveLength(1);
		expect(page.getByRole('heading', { level: 2 }).elements()).toHaveLength(2);
	});

	it('routes Get started to /signup and both Sign in links to /login', async () => {
		render(HomePage);
		await expect
			.element(page.getByRole('link', { name: 'Get started' }))
			.toHaveAttribute('href', '/signup');
		const signIns = page.getByRole('link', { name: 'Sign in' }).elements();
		expect(signIns).toHaveLength(2);
		for (const a of signIns) expect(a.getAttribute('href')).toBe('/login');
	});
});
