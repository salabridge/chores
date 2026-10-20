import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { GiftItem } from '#lib/gift.js';
import GiftMoment from './GiftMoment.svelte';

const gifts: GiftItem[] = [
	{
		id: 'g1',
		points: 20,
		reason: 'Helped Grandma with groceries',
		fromName: 'Mom',
		createdAt: '2026-10-14T12:00:00.000Z',
	},
	{
		id: 'g2',
		points: 5,
		reason: 'Good report card',
		fromName: null,
		createdAt: '2026-10-12T12:00:00.000Z',
	},
];

describe('GiftMoment.svelte', () => {
	it('opens as a modal dialog named by its heading', async () => {
		render(GiftMoment, { gifts: gifts.slice(0, 1), ondismiss: vi.fn() });
		const dialog = page.getByRole('dialog', { name: 'You got bonus points!' });
		await expect.element(dialog).toBeVisible();
		expect((dialog.element() as HTMLDialogElement).open).toBe(true);
	});

	it('shows one gift with its giver and reason', async () => {
		render(GiftMoment, { gifts: gifts.slice(0, 1), ondismiss: vi.fn() });
		await expect
			.element(page.getByText('+20 from Mom · Helped Grandma with groceries'))
			.toBeVisible();
		await expect
			.element(page.getByTestId('gift-total'))
			.toHaveTextContent('+20 pts');
		expect(page.getByText(/Here are your/).elements()).toHaveLength(0);
	});

	it('combines several gifts into one total and one list', async () => {
		render(GiftMoment, { gifts, ondismiss: vi.fn() });
		await expect
			.element(page.getByTestId('gift-total'))
			.toHaveTextContent('+25 pts');
		await expect
			.element(page.getByText('Here are your 2 gifts.'))
			.toBeVisible();
		expect(page.getByRole('listitem').elements()).toHaveLength(2);
		await expect
			.element(page.getByText('+5 · Good report card', { exact: true }))
			.toBeVisible();
	});

	it('says gifts do not count toward the weekly goal', async () => {
		render(GiftMoment, { gifts, ondismiss: vi.fn() });
		await expect.element(page.getByText(/not your weekly goal/)).toBeVisible();
	});

	it('calls ondismiss from the button, and not before', async () => {
		const ondismiss = vi.fn();
		render(GiftMoment, { gifts, ondismiss });
		await expect
			.element(page.getByRole('button', { name: 'Awesome!' }))
			.toBeVisible();
		expect(ondismiss).not.toHaveBeenCalled();
		await page.getByRole('button', { name: 'Awesome!' }).click();
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	it('treats Escape as dismissing it', async () => {
		const ondismiss = vi.fn();
		render(GiftMoment, { gifts, ondismiss });
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await userEvent.keyboard('{Escape}');
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	it('ignores taps while it is being dismissed', async () => {
		const ondismiss = vi.fn();
		render(GiftMoment, { gifts, ondismiss, pending: true });
		await expect
			.element(page.getByRole('button', { name: 'Awesome!' }))
			.toBeDisabled();
		await userEvent.keyboard('{Escape}');
		expect(ondismiss).not.toHaveBeenCalled();
	});
});
