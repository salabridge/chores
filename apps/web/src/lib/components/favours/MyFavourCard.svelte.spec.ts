import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import {
	approvedByOwner,
	approvedByParent,
	declinedByOwner,
	declinedByParent,
	waitingForOwner,
	waitingForParent,
} from './fixtures.ts';
import MyFavourCard from './MyFavourCard.svelte';

const actions = () => ({ askParent: vi.fn(async (_id: string) => {}) });

describe('MyFavourCard.svelte', () => {
	it('waits for the owner and offers Ask a parent', async () => {
		const a = actions();
		render(MyFavourCard, { item: waitingForOwner, actions: a });
		await expect.element(page.getByText('Waiting for Leo')).toBeVisible();
		await page.getByRole('button', { name: /Ask a parent/ }).click();
		expect(a.askParent).toHaveBeenCalledWith('c1');
	});

	it('reads "Waiting for a parent" once escalated, with no button', async () => {
		render(MyFavourCard, { item: waitingForParent, actions: actions() });
		await expect.element(page.getByText('Waiting for a parent')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('shows the points and who approved', async () => {
		render(MyFavourCard, { item: approvedByOwner, actions: actions() });
		await expect.element(page.getByText('+10 pts, Leo approved')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('names a parent who decided', async () => {
		render(MyFavourCard, { item: approvedByParent, actions: actions() });
		await expect
			.element(page.getByText('+20 pts, Dad (a parent) approved'))
			.toBeVisible();
	});

	it('lets a declined favour go to a parent, but not a parent-declined one', async () => {
		const view = render(MyFavourCard, {
			item: declinedByOwner,
			actions: actions(),
		});
		await expect.element(page.getByText('Leo said not done')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /Ask a parent/ }))
			.toBeVisible();
		await view.rerender({ item: declinedByParent });
		await expect
			.element(page.getByText('Dad (a parent) said not done'))
			.toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('shows why asking failed', async () => {
		const a = actions();
		a.askParent.mockRejectedValueOnce(
			new Error('A parent already decided this favour.'),
		);
		render(MyFavourCard, { item: waitingForOwner, actions: a });
		await page.getByRole('button', { name: /Ask a parent/ }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('A parent already decided this favour.');
	});
});
