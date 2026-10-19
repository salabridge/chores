import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The Storybook mock, except that submitting succeeds.
vi.mock('#lib/members.remote.js', async () => {
	const { submittable } = await import(
		'../../../../.storybook/mocks/profiles-remote.ts'
	);
	const remote = await import('../../../../.storybook/mocks/members-remote.ts');
	return { ...remote, giftPoints: submittable(remote.giftPoints) };
});

import { members } from './fixtures.ts';
import GiftPointsForm from './GiftPointsForm.svelte';

const mia = members[2];

describe('GiftPointsForm.svelte', () => {
	it('offers the quick amounts, a custom amount and a reason', async () => {
		render(GiftPointsForm, { member: mia });
		for (const amount of [5, 10, 20, 50]) {
			await expect
				.element(page.getByRole('button', { name: `+${amount}`, exact: true }))
				.toBeVisible();
		}
		await expect
			.element(page.getByLabelText('Points', { exact: true }))
			.toBeVisible();
		await expect.element(page.getByLabelText('Reason')).toBeVisible();
	});

	it('fills the amount from a quick amount', async () => {
		render(GiftPointsForm, { member: mia });
		await page.getByRole('button', { name: '+20' }).click();
		await expect
			.element(page.getByLabelText('Points', { exact: true }))
			.toHaveValue('20');
		await expect
			.element(page.getByRole('button', { name: '+20' }))
			.toHaveAttribute('aria-pressed', 'true');
		await page.getByLabelText('Points', { exact: true }).fill('35');
		await expect
			.element(page.getByRole('button', { name: '+20' }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('tells the parent how many points were given, or that it was cancelled', async () => {
		const onsaved = vi.fn();
		const oncancel = vi.fn();
		render(GiftPointsForm, { member: mia, onsaved, oncancel });
		await page.getByRole('button', { name: '+10' }).click();
		await page.getByLabelText('Reason').fill('Helped Grandma with groceries');
		await page.getByRole('button', { name: 'Give points' }).click();
		await vi.waitFor(() => expect(onsaved).toHaveBeenCalledWith(10));
		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(oncancel).toHaveBeenCalledOnce();
	});
});
