import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import BottomNav from './BottomNav.svelte';

describe('BottomNav.svelte', () => {
	it('renders Today, Rewards and Streak links', async () => {
		render(BottomNav, { pathname: '/today' });
		await expect
			.element(page.getByRole('link', { name: 'Rewards' }))
			.toHaveAttribute('href', '/rewards');
		await expect
			.element(page.getByRole('link', { name: 'Streak' }))
			.toHaveAttribute('href', '/streak');
	});

	it('adds Overview and Account only for a parent', async () => {
		const view = render(BottomNav, { pathname: '/today' });
		await expect
			.element(page.getByRole('link', { name: 'Account' }))
			.not.toBeInTheDocument();
		await view.rerender({ pathname: '/today', parent: true });
		await expect
			.element(page.getByRole('link', { name: 'Overview' }))
			.toHaveAttribute('href', '/overview');
		await expect
			.element(page.getByRole('link', { name: 'Account' }))
			.toHaveAttribute('href', '/account');
	});

	it('marks only the current tab with aria-current="page"', async () => {
		render(BottomNav, { pathname: '/rewards' });
		await expect
			.element(page.getByRole('link', { name: 'Rewards' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Today' }))
			.not.toHaveAttribute('aria-current');
	});

	it('marks no tab active on other routes', async () => {
		render(BottomNav, { pathname: '/chores/1' });
		await expect
			.element(page.getByRole('link', { name: 'Today' }))
			.not.toHaveAttribute('aria-current');
	});
});
