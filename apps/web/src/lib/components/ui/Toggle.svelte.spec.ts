import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Toggle from './Toggle.svelte';

describe('Toggle.svelte', () => {
	it('is a switch, off by default', async () => {
		render(Toggle, { 'aria-label': 'Mom' });
		const toggle = page.getByRole('switch', { name: 'Mom' });
		await expect.element(toggle).toHaveAttribute('aria-checked', 'false');
		await expect.element(toggle).toHaveAttribute('type', 'button');
	});

	it('reflects checked', async () => {
		render(Toggle, { 'aria-label': 'Mom', checked: true });
		await expect
			.element(page.getByRole('switch'))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('flips on click', async () => {
		render(Toggle, { 'aria-label': 'Mom' });
		const toggle = page.getByRole('switch');
		await toggle.click();
		await expect.element(toggle).toHaveAttribute('aria-checked', 'true');
		await toggle.click();
		await expect.element(toggle).toHaveAttribute('aria-checked', 'false');
	});

	it('flips with Space and Enter', async () => {
		render(Toggle, { 'aria-label': 'Mom' });
		const toggle = page.getByRole('switch');
		toggle.element().focus();
		await userEvent.keyboard(' ');
		await expect.element(toggle).toHaveAttribute('aria-checked', 'true');
		await userEvent.keyboard('{Enter}');
		await expect.element(toggle).toHaveAttribute('aria-checked', 'false');
	});

	it('does not flip when disabled', async () => {
		render(Toggle, { 'aria-label': 'Mom', disabled: true });
		const toggle = page.getByRole('switch');
		await expect.element(toggle).toBeDisabled();
		await expect.element(toggle).toHaveAttribute('aria-checked', 'false');
	});
});
