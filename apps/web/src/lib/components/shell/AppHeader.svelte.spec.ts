import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

const member = { name: 'Leo', points: 140 };

describe('AppHeader.svelte', () => {
	it('greets the member and shows their points', async () => {
		render(AppHeader, { pathname: '/today', member });
		await expect.element(page.getByText('Hey Leo!')).toBeVisible();
		await expect
			.element(page.getByText('Ready to spin the loop?'))
			.toBeVisible();
		await expect.element(page.getByText('140 pts')).toBeVisible();
	});

	it("rings the avatar in the member's own colour", async () => {
		render(AppHeader, {
			pathname: '/today',
			member: { ...member, tone: 'green' },
		});
		await expect
			.element(page.getByRole('img', { name: 'Leo' }))
			.toHaveClass('border-border-green');
	});

	it('links the three tabs and marks only the current one', async () => {
		render(AppHeader, { pathname: '/rewards/history', member });
		const nav = page.getByRole('navigation', { name: 'Main' });
		await expect
			.element(nav.getByRole('link', { name: 'Today' }))
			.toHaveAttribute('href', '/today');
		await expect
			.element(nav.getByRole('link', { name: 'Rewards' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(nav.getByRole('link', { name: 'Streak' }))
			.not.toHaveAttribute('aria-current');
	});

	it('shows only the nav without a member', async () => {
		render(AppHeader, { pathname: '/today' });
		await expect
			.element(page.getByRole('link', { name: 'Today' }))
			.toBeVisible();
		await expect.element(page.getByText('pts')).not.toBeInTheDocument();
		await expect.element(page.getByText('Hey')).not.toBeInTheDocument();
	});
});
