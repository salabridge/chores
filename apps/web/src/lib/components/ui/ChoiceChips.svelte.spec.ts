import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ChoiceChips from './ChoiceChips.svelte';

const frequency = [
	{ value: 'daily', label: 'Daily' },
	{ value: 'weekly', label: 'Weekly' },
	{ value: 'weekends', label: 'Weekends' },
];

describe('ChoiceChips.svelte', () => {
	it('renders a named radiogroup with a radio per option', async () => {
		render(ChoiceChips, { label: 'Frequency', options: frequency });
		await expect
			.element(page.getByRole('radiogroup', { name: 'Frequency' }))
			.toBeVisible();
		expect(page.getByRole('radio').elements()).toHaveLength(3);
	});

	it('checks the option matching value', async () => {
		render(ChoiceChips, {
			label: 'Frequency',
			options: frequency,
			value: 'weekly',
		});
		await expect
			.element(page.getByRole('radio', { name: 'Weekly' }))
			.toBeChecked();
		await expect
			.element(page.getByRole('radio', { name: 'Daily' }))
			.not.toBeChecked();
	});

	it('selects on click', async () => {
		render(ChoiceChips, { label: 'Frequency', options: frequency });
		await page.getByText('Weekends').click();
		await expect
			.element(page.getByRole('radio', { name: 'Weekends' }))
			.toBeChecked();
	});

	it('supports numeric values and falls back to value as label', async () => {
		render(ChoiceChips, {
			label: 'Reward Points',
			options: [{ value: 5 }, { value: 10 }, { value: 15 }],
			value: 15,
		});
		await expect
			.element(page.getByRole('radio', { name: '15', exact: true }))
			.toBeChecked();
		await page.getByText('5', { exact: true }).click();
		await expect
			.element(page.getByRole('radio', { name: '5', exact: true }))
			.toBeChecked();
	});

	it('moves selection with arrow keys', async () => {
		render(ChoiceChips, {
			label: 'Frequency',
			options: frequency,
			value: 'daily',
		});
		page.getByRole('radio', { name: 'Daily' }).element().focus();
		await userEvent.keyboard('{ArrowRight}');
		await expect
			.element(page.getByRole('radio', { name: 'Weekly' }))
			.toBeChecked();
	});

	it('disables every chip when disabled', async () => {
		render(ChoiceChips, {
			label: 'Frequency',
			options: frequency,
			disabled: true,
		});
		await expect
			.element(page.getByRole('radio', { name: 'Daily' }))
			.toBeDisabled();
	});
});
