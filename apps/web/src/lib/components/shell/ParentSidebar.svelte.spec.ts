import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ParentSidebar from './ParentSidebar.svelte';

describe('ParentSidebar.svelte', () => {
	it('links to the portal pages', async () => {
		render(ParentSidebar, { pathname: '/overview' });
		await expect
			.element(page.getByRole('link', { name: 'Overview' }))
			.toHaveAttribute('href', '/overview');
		await expect
			.element(page.getByRole('link', { name: 'Create & Assign' }))
			.toHaveAttribute('href', '/chores/new');
		await expect
			.element(page.getByRole('link', { name: 'Chores', exact: true }))
			.toHaveAttribute('href', '/chores');
		await expect
			.element(page.getByRole('link', { name: 'Rotation Builder' }))
			.toHaveAttribute('href', '/rotations');
	});

	it('marks Chores active on the list but not on Create & Assign', async () => {
		const chores = () =>
			page.getByRole('link', { name: 'Chores', exact: true });
		const create = () => page.getByRole('link', { name: 'Create & Assign' });
		const view = render(ParentSidebar, { pathname: '/chores' });
		await expect.element(chores()).toHaveAttribute('aria-current', 'page');
		await expect.element(create()).not.toHaveAttribute('aria-current');
		await view.rerender({ pathname: '/chores/new' });
		await expect.element(create()).toHaveAttribute('aria-current', 'page');
		await expect.element(chores()).not.toHaveAttribute('aria-current');
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
