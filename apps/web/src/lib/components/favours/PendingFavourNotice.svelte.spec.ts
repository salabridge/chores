import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { pendingByMia } from './fixtures.ts';
import PendingFavourNotice from './PendingFavourNotice.svelte';

const props = () => ({
	favour: pendingByMia,
	title: 'Take Out Trash',
	points: 10,
	ownerName: 'Leo',
	viewer: { id: 'leo', isOwner: true, isParent: false },
	actions: {
		approve: vi.fn(async (_id: string) => {}),
		decline: vi.fn(async (_id: string) => {}),
		askParent: vi.fn(async (_id: string) => {}),
	},
});

describe('PendingFavourNotice.svelte', () => {
	it('gives the owner the approval card', async () => {
		const p = props();
		render(PendingFavourNotice, p);
		await page.getByRole('button', { name: "Yes, it's done" }).click();
		expect(p.actions.approve).toHaveBeenCalledWith('c1');
	});

	it('shows the doer where it stands and lets them ask a parent', async () => {
		const p = {
			...props(),
			viewer: { id: 'mia', isOwner: false, isParent: false },
		};
		render(PendingFavourNotice, p);
		await expect.element(page.getByText('Waiting for Leo')).toBeVisible();
		await expect
			.element(page.getByText(/You'll get \+10 points/))
			.toBeVisible();
		await page.getByRole('button', { name: 'Ask a parent' }).click();
		expect(p.actions.askParent).toHaveBeenCalledWith('c1');
	});

	it('shows "Waiting for a parent" once escalated, without the button', async () => {
		const p = {
			...props(),
			favour: { ...pendingByMia, escalated: true },
			viewer: { id: 'mia', isOwner: false, isParent: false },
		};
		render(PendingFavourNotice, p);
		await expect.element(page.getByText('Waiting for a parent')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('takes the owner out of it once escalated, and gives a parent the card', async () => {
		const escalated = { ...pendingByMia, escalated: true };
		const view = render(PendingFavourNotice, { ...props(), favour: escalated });
		expect(page.getByRole('button').elements()).toHaveLength(0);
		await view.rerender({
			viewer: { id: 'dad', isOwner: false, isParent: true },
		});
		await expect
			.element(page.getByRole('button', { name: "Yes, it's done" }))
			.toBeVisible();
	});

	it('lets anyone else follow along', async () => {
		render(PendingFavourNotice, {
			...props(),
			viewer: { id: 'sam', isOwner: false, isParent: false },
		});
		await expect.element(page.getByText('Waiting for an OK')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});
});
