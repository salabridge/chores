import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The real remote file imports server code; use the Storybook stand-in.
vi.mock('#lib/profiles.remote.js', async () => {
	return await import('../../../../.storybook/mocks/profiles-remote.ts');
});

import SetPinForm from './SetPinForm.svelte';

describe('SetPinForm.svelte', () => {
	it('renders New PIN and Confirm PIN as identical inputs', async () => {
		render(SetPinForm);
		const first = page.getByLabelText('New PIN (4 to 6 digits)');
		const second = page.getByLabelText('Confirm PIN');
		for (const input of [first, second]) {
			await expect.element(input).toHaveAttribute('type', 'password');
			await expect.element(input).toHaveAttribute('inputmode', 'numeric');
			await expect.element(input).toHaveAttribute('pattern', '[0-9]{4,6}');
			await expect.element(input).toHaveAttribute('maxlength', '6');
		}
		await expect.element(first).toHaveAttribute('name', '_pin');
		await expect.element(second).toHaveAttribute('name', '_confirmPin');
	});

	it('tabs New PIN, Confirm PIN, Save PIN', async () => {
		render(SetPinForm);
		await page.getByLabelText('New PIN (4 to 6 digits)').click();
		await userEvent.tab();
		await expect.element(page.getByLabelText('Confirm PIN')).toHaveFocus();
		await userEvent.tab();
		await expect
			.element(page.getByRole('button', { name: 'Save PIN' }))
			.toHaveFocus();
	});

	it('tabs New PIN, Confirm PIN, Account password, Save PIN when changing a PIN', async () => {
		render(SetPinForm, { requirePassword: true });
		await page.getByLabelText('New PIN (4 to 6 digits)').click();
		await userEvent.tab();
		await expect.element(page.getByLabelText('Confirm PIN')).toHaveFocus();
		await userEvent.tab();
		await expect.element(page.getByLabelText('Account password')).toHaveFocus();
		// Skip the show-password toggle.
		await userEvent.tab();
		await userEvent.tab();
		await expect
			.element(page.getByRole('button', { name: 'Save PIN' }))
			.toHaveFocus();
	});

	it('has no keypad buttons', async () => {
		const { container } = render(SetPinForm);
		expect(container.querySelectorAll('button')).toHaveLength(1);
	});
});
