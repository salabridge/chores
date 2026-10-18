import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import RepeatableToggle from './RepeatableToggle.svelte';

const toggle = () =>
	page.getByRole('switch', { name: 'Can be claimed more than once' });

describe('RepeatableToggle.svelte', () => {
	it('explains the one-claim limit when off', async () => {
		render(RepeatableToggle, { checked: false });
		await expect.element(toggle()).not.toBeChecked();
		await expect
			.element(page.getByText('Each kid can claim this once.'))
			.toBeVisible();
	});

	it('explains unlimited claims when on', async () => {
		render(RepeatableToggle, { checked: true });
		await expect.element(toggle()).toBeChecked();
		await expect
			.element(
				page.getByText(
					'Kids can claim this again whenever they have enough points, with no limit.',
				),
			)
			.toBeVisible();
	});

	it('changes the text when toggled', async () => {
		render(RepeatableToggle, { checked: false });
		await toggle().click();
		await expect.element(page.getByText(/with no limit/)).toBeInTheDocument();
		await toggle().click();
		await expect
			.element(page.getByText('Each kid can claim this once.'))
			.toBeInTheDocument();
	});

	it('links the helper text to the switch for screen readers', async () => {
		render(RepeatableToggle, { checked: false, id: 'r' });
		await expect
			.element(toggle())
			.toHaveAccessibleDescription('Each kid can claim this once.');
		await toggle().click();
		await expect
			.element(toggle())
			.toHaveAccessibleDescription(
				'Kids can claim this again whenever they have enough points, with no limit.',
			);
	});
});
