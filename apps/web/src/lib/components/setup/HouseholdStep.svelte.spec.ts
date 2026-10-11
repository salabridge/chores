import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The real remote file imports server code; use the Storybook stand-in.
vi.mock('#lib/setup.remote.js', async () => {
	return await import('../../../../.storybook/mocks/setup-remote.ts');
});

import HouseholdStep from './HouseholdStep.svelte';

describe('HouseholdStep.svelte', () => {
	it('asks for a household name and a time zone', async () => {
		render(HouseholdStep, { timezone: 'America/Chicago' });
		await expect.element(page.getByLabelText('Household name')).toBeVisible();
		await expect
			.element(page.getByLabelText('Time zone'))
			.toHaveValue('America/Chicago');
		await expect
			.element(page.getByRole('button', { name: 'Continue' }))
			.toBeVisible();
	});

	it('shows a saved name when resuming', async () => {
		render(HouseholdStep, { name: 'The Smiths', timezone: 'America/Chicago' });
		await expect
			.element(page.getByLabelText('Household name'))
			.toHaveValue('The Smiths');
	});

	it('defaults the time zone to the browser when none is saved', async () => {
		render(HouseholdStep);
		const expected = Intl.DateTimeFormat().resolvedOptions().timeZone;
		await expect
			.element(page.getByLabelText('Time zone'))
			.toHaveValue(expected);
	});
});
