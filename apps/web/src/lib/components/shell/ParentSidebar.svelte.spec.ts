import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ParentSidebar from './ParentSidebar.svelte';

describe('ParentSidebar.svelte', () => {
	it('links to the three portal pages', async () => {
		render(ParentSidebar, { pathname: '/overview' });
		await expect
			.element(page.getByRole('link', { name: 'Overview' }))
			.toHaveAttribute('href', '/overview');
		await expect
			.element(page.getByRole('link', { name: 'Create & Assign' }))
			.toHaveAttribute('href', '/chores/new');
		await expect
			.element(page.getByRole('link', { name: 'Rotation Builder' }))
			.toHaveAttribute('href', '/rotations');
	});

	it('marks only the current page with aria-current', async () => {
		render(ParentSidebar, { pathname: '/rotations' });
		await expect
			.element(page.getByRole('link', { name: 'Rotation Builder' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Overview' }))
			.not.toHaveAttribute('aria-current');
	});

	it('shows the parents from household data', async () => {
		render(ParentSidebar, {
			pathname: '/overview',
			parentNames: ['Mom', 'Dad'],
		});
		await expect.element(page.getByText('Mom & Dad')).toBeVisible();
		await expect.element(page.getByText('Co-Captains')).toBeVisible();
		await expect.element(page.getByText('PARENT PORTAL ACTIVE')).toBeVisible();
	});
});
