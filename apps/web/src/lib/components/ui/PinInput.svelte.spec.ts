import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PinInput from './PinInput.svelte';

describe('PinInput.svelte', () => {
	it('is a numeric password input with a visible label', async () => {
		render(PinInput, { label: 'Parent PIN', name: '_pin' });
		const input = page.getByLabelText('Parent PIN');
		await expect.element(input).toBeVisible();
		await expect.element(input).toHaveAttribute('type', 'password');
		await expect.element(input).toHaveAttribute('inputmode', 'numeric');
		await expect.element(input).toHaveAttribute('autocomplete', 'off');
		await expect.element(input).toHaveAttribute('pattern', '[0-9]{4,6}');
		await expect.element(input).toHaveAttribute('name', '_pin');
	});

	it('renders no keypad buttons', async () => {
		const { container } = render(PinInput, { label: 'Parent PIN' });
		expect(container.querySelectorAll('button')).toHaveLength(0);
	});

	it('strips non-digits as you type', async () => {
		render(PinInput, { label: 'Parent PIN' });
		const input = page.getByLabelText('Parent PIN');
		await input.click();
		await userEvent.keyboard('4a8-2 1');
		await expect.element(input).toHaveValue('4821');
	});

	it('strips non-digits from pasted text', async () => {
		render(PinInput, { label: 'Parent PIN' });
		const input = page.getByLabelText('Parent PIN');
		await input.fill('12-34');
		await expect.element(input).toHaveValue('1234');
	});

	it('stops at the maximum length', async () => {
		render(PinInput, { label: 'Parent PIN', maxLength: 4 });
		const input = page.getByLabelText('Parent PIN');
		await input.click();
		await userEvent.keyboard('123456');
		await expect.element(input).toHaveValue('1234');
		await expect.element(input).toHaveAttribute('maxlength', '4');
	});

	it('is disabled when disabled', async () => {
		render(PinInput, { label: 'Parent PIN', disabled: true });
		await expect.element(page.getByLabelText('Parent PIN')).toBeDisabled();
	});

	it('shows issues', async () => {
		render(PinInput, {
			label: 'Parent PIN',
			issues: [{ message: 'PIN is too short' }],
		});
		await expect.element(page.getByText('PIN is too short')).toBeVisible();
	});
});
