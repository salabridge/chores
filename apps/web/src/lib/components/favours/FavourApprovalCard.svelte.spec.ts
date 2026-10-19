import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FavourApprovalCard from './FavourApprovalCard.svelte';
import { needsOk } from './fixtures.ts';

const actions = () => ({
	approve: vi.fn(async (_id: string) => {}),
	decline: vi.fn(async (_id: string) => {}),
});

describe('FavourApprovalCard.svelte', () => {
	it('says who did what and who gets the points', async () => {
		render(FavourApprovalCard, { item: needsOk, actions: actions() });
		await expect.element(page.getByText('Needs your OK')).toBeVisible();
		await expect
			.element(page.getByTestId('favour-approval'))
			.toHaveTextContent(
				'Mia says they did Take Out Trash. +10 pts go to Mia.',
			);
	});

	it('approves with "Yes, it\'s done"', async () => {
		const a = actions();
		render(FavourApprovalCard, { item: needsOk, actions: a });
		await page.getByRole('button', { name: "Yes, it's done" }).click();
		expect(a.approve).toHaveBeenCalledWith('c1');
		expect(a.decline).not.toHaveBeenCalled();
	});

	it('declines with "Not done"', async () => {
		const a = actions();
		render(FavourApprovalCard, { item: needsOk, actions: a });
		await page.getByRole('button', { name: 'Not done' }).click();
		expect(a.decline).toHaveBeenCalledWith('c1');
	});

	it('shows the error when it fails and lets the member try again', async () => {
		const a = actions();
		a.approve.mockRejectedValueOnce(
			new Error('Someone already decided this favour.'),
		);
		render(FavourApprovalCard, { item: needsOk, actions: a });
		await page.getByRole('button', { name: "Yes, it's done" }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Someone already decided this favour.');
		await expect
			.element(page.getByRole('button', { name: "Yes, it's done" }))
			.toBeEnabled();
	});
});
