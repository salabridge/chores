import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The real remote file imports server code; use the Storybook stand-in.
vi.mock('#lib/profiles.remote.js', async () => {
	return await import('../../../../.storybook/mocks/profiles-remote.ts');
});
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

import ParentPinDialog from './ParentPinDialog.svelte';

describe('ParentPinDialog.svelte', () => {
	it('focuses the PIN input when the dialog opens', async () => {
		render(ParentPinDialog, { open: true, memberName: 'Mia' });
		const pin = page.getByLabelText('Enter PIN', { exact: true });
		await expect.element(pin).toHaveFocus();
		await expect.element(pin).toHaveAttribute('inputmode', 'numeric');
		await expect.element(pin).toHaveAttribute('type', 'password');
	});

	it('tabs PIN, Switch profile, Forgot your PIN, Cancel', async () => {
		render(ParentPinDialog, { open: true, memberName: 'Mia' });
		await expect
			.element(page.getByLabelText('Enter PIN', { exact: true }))
			.toHaveFocus();
		await userEvent.tab();
		await expect
			.element(page.getByRole('button', { name: 'Switch profile' }))
			.toHaveFocus();
		await userEvent.tab();
		await expect.element(page.getByText('Forgot your PIN?')).toHaveFocus();
		await userEvent.tab();
		await expect
			.element(page.getByRole('button', { name: 'Cancel' }))
			.toHaveFocus();
	});

	it('shows the password unlock instead of a PIN field when locked', async () => {
		render(ParentPinDialog, { open: true, memberName: 'Mia', locked: true });
		await expect
			.element(page.getByLabelText('Account password').first())
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Unlock' }))
			.toBeVisible();
	});
});
