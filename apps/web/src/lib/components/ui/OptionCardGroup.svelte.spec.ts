import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Host from './OptionCardGroup.host.svelte';

describe('OptionCardGroup / OptionCard', () => {
	it('exposes a named radiogroup of radios', async () => {
		render(Host, {});
		await expect
			.element(page.getByRole('radiogroup', { name: 'Chore type' }))
			.toBeVisible();
		await expect.element(page.getByRole('radio').first()).toBeInTheDocument();
		expect(page.getByRole('radio').elements()).toHaveLength(3);
	});

	it('reflects the bound value as checked', async () => {
		render(Host, { value: 'shared' });
		await expect
			.element(page.getByRole('radio', { name: 'Household Rotation' }))
			.toBeChecked();
		await expect
			.element(page.getByRole('radio', { name: 'Personal Chore' }))
			.not.toBeChecked();
	});

	it('selects on click and updates the bound value', async () => {
		render(Host, {});
		await page.getByText('Personal Chore').click();
		await expect
			.element(page.getByRole('radio', { name: 'Personal Chore' }))
			.toBeChecked();
		await expect
			.element(page.getByTestId('value'))
			.toHaveTextContent('personal');
	});

	it('moves selection with arrow keys, skipping disabled cards', async () => {
		render(Host, { value: 'personal' });
		page.getByRole('radio', { name: 'Personal Chore' }).element().focus();
		await userEvent.keyboard('{ArrowRight}');
		await expect
			.element(page.getByRole('radio', { name: 'Household Rotation' }))
			.toBeChecked();
		await expect.element(page.getByTestId('value')).toHaveTextContent('shared');
		await userEvent.keyboard('{ArrowRight}');
		// "Other" is disabled, so focus wraps back to the first card.
		await expect
			.element(page.getByRole('radio', { name: 'Personal Chore' }))
			.toBeChecked();
	});

	it('does not select a disabled card', async () => {
		render(Host, {});
		await expect
			.element(page.getByRole('radio', { name: 'Other' }))
			.toBeDisabled();
	});

	it('styles the selected card by accent', async () => {
		render(Host, { value: 'shared', accent: 'blue' });
		const card = page
			.getByText('Household Rotation')
			.element()
			.closest('label');
		if (!card) throw new Error('Expected the option to be inside a label');
		await expect.element(card).toHaveClass('border-border-blue');
	});
});
