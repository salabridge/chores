import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Textarea from './Textarea.svelte';

describe('Textarea.svelte', () => {
	it('labels the textarea', async () => {
		render(Textarea, { label: 'Parent Note' });
		await expect
			.element(page.getByRole('textbox', { name: 'Parent Note' }))
			.toBeVisible();
	});

	it('accepts typed input', async () => {
		render(Textarea, { label: 'Parent Note' });
		const field = page.getByRole('textbox', { name: 'Parent Note' });
		await field.fill('Load the machine');
		await expect.element(field).toHaveValue('Load the machine');
	});

	it('links a hint via aria-describedby', async () => {
		render(Textarea, { label: 'Parent Note', hint: 'Optional' });
		const field = page.getByRole('textbox');
		await expect.element(page.getByText('Optional')).toBeVisible();
		await expect.element(field).toHaveAccessibleDescription('Optional');
	});

	it('shows issues instead of the hint and marks the field invalid', async () => {
		render(Textarea, {
			label: 'Parent Note',
			hint: 'Optional',
			issues: [{ message: 'Too long' }],
		});
		const field = page.getByRole('textbox');
		await expect.element(field).toHaveAccessibleDescription('Too long');
		await expect.element(field).toHaveAttribute('aria-invalid', 'true');
		expect(page.getByText('Optional').elements()).toHaveLength(0);
	});
});
