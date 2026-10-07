import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ReorderButtons from './ReorderButtons.svelte';

describe('ReorderButtons.svelte', () => {
	it('names each button after the member', async () => {
		render(ReorderButtons, { name: 'Leo' });
		await expect
			.element(page.getByRole('button', { name: 'Move Leo up' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Move Leo down' }))
			.toBeVisible();
	});

	it('reports the direction', async () => {
		const onmove = vi.fn();
		render(ReorderButtons, { name: 'Leo', onmove });
		await page.getByRole('button', { name: 'Move Leo up' }).click();
		await page.getByRole('button', { name: 'Move Leo down' }).click();
		expect(onmove.mock.calls).toEqual([['up'], ['down']]);
	});

	it('disables a direction that has nowhere to go', async () => {
		render(ReorderButtons, { name: 'Leo', canMoveUp: false });
		await expect
			.element(page.getByRole('button', { name: 'Move Leo up' }))
			.toBeDisabled();
		await expect
			.element(page.getByRole('button', { name: 'Move Leo down' }))
			.toBeEnabled();
	});

	it('disables both when disabled', async () => {
		render(ReorderButtons, { name: 'Leo', disabled: true });
		await expect
			.element(page.getByRole('button', { name: 'Move Leo up' }))
			.toBeDisabled();
		await expect
			.element(page.getByRole('button', { name: 'Move Leo down' }))
			.toBeDisabled();
	});
});
