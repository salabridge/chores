import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/members.remote.js', async () => {
	return await import('../../../../.storybook/mocks/members-remote.ts');
});

import { MAX_KIDS } from '#lib/setup.js';
import AddManagedKidForm from './AddManagedKidForm.svelte';

describe('AddManagedKidForm.svelte', () => {
	it('asks for a name, optional birth year, and a goal defaulting to 200', async () => {
		render(AddManagedKidForm, { kidCount: 2 });
		await expect.element(page.getByLabelText("Kid's name")).toBeVisible();
		await expect
			.element(page.getByLabelText('Birth year (optional)'))
			.toBeVisible();
		await expect
			.element(page.getByLabelText('Weekly points goal'))
			.toHaveValue('200');
		await expect
			.element(page.getByRole('button', { name: 'Add kid' }))
			.toBeVisible();
	});

	it('only accepts a four-digit birth year', async () => {
		render(AddManagedKidForm, { kidCount: 0 });
		const year = page.getByLabelText('Birth year (optional)');
		await expect.element(year).toHaveAttribute('pattern', '[0-9]{4}');
		await year.fill('2017');
		await expect.element(year).toBeValid();
	});

	it('explains the household is full at the kid cap', async () => {
		render(AddManagedKidForm, { kidCount: MAX_KIDS });
		await expect
			.element(page.getByText(`A household can have up to ${MAX_KIDS} kids.`))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Add kid' }))
			.not.toBeInTheDocument();
	});
});
