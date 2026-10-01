import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PinPad from './PinPad.svelte';

describe('PinPad.svelte', () => {
	it('types digits from the keypad into the PIN field', async () => {
		render(PinPad, { label: 'Parent PIN', name: '_pin' });
		for (const digit of ['4', '8', '2', '1']) {
			await page.getByRole('button', { name: digit, exact: true }).click();
		}
		await expect.element(page.getByLabelText('Parent PIN')).toHaveValue('4821');
	});

	it('deletes the last digit', async () => {
		render(PinPad, { label: 'Parent PIN', value: '123' });
		await page.getByRole('button', { name: 'Delete last digit' }).click();
		await expect.element(page.getByLabelText('Parent PIN')).toHaveValue('12');
	});

	it('stops at the maximum length', async () => {
		render(PinPad, { label: 'Parent PIN', value: '1234', maxLength: 4 });
		await page.getByRole('button', { name: '5', exact: true }).click();
		await expect.element(page.getByLabelText('Parent PIN')).toHaveValue('1234');
	});

	it('disables the keypad when disabled', async () => {
		render(PinPad, { label: 'Parent PIN', disabled: true });
		await expect
			.element(page.getByRole('button', { name: '1', exact: true }))
			.toBeDisabled();
	});
});
