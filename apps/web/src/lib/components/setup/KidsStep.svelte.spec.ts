import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/setup.remote.js', async () => {
	return await import('../../../../.storybook/mocks/setup-remote.ts');
});

import KidsStep, { type SetupKid } from './KidsStep.svelte';

const kids: SetupKid[] = [
	{
		id: 'k1',
		displayName: 'Mia',
		birthYear: 2017,
		weeklyGoalPoints: 200,
		avatarColor: 'blue',
	},
	{
		id: 'k2',
		displayName: 'Leo',
		birthYear: null,
		weeklyGoalPoints: 150,
		avatarColor: null,
	},
];

describe('KidsStep.svelte', () => {
	it('blocks Continue until a kid is added', async () => {
		render(KidsStep, { kids: [] });
		await expect
			.element(page.getByRole('button', { name: 'Continue' }))
			.toBeDisabled();
		await expect
			.element(page.getByText('Add at least one kid to continue.'))
			.toBeVisible();
	});

	it('lists the kids with their goal and birth year', async () => {
		render(KidsStep, { kids });
		await expect
			.element(page.getByText('200 points a week, born 2017'))
			.toBeVisible();
		await expect.element(page.getByText('150 points a week')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Continue' }))
			.toBeEnabled();
	});

	it('has a remove button per kid', async () => {
		render(KidsStep, { kids });
		await expect
			.element(page.getByRole('button', { name: 'Remove Mia' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Remove Leo' }))
			.toBeVisible();
	});

	it('defaults the weekly goal to 200 and says own logins are coming', async () => {
		render(KidsStep, { kids: [] });
		await expect
			.element(page.getByLabelText('Weekly points goal'))
			.toHaveValue('200');
		await expect.element(page.getByText(/coming soon/)).toBeVisible();
	});

	it('only accepts a four-digit birth year', async () => {
		render(KidsStep, { kids: [] });
		const year = page.getByLabelText('Birth year (optional)');
		await expect.element(year).toHaveAttribute('pattern', '[0-9]{4}');
		await year.fill('2017');
		await expect.element(year).toBeValid();
	});

	it('calls oncontinue', async () => {
		const oncontinue = vi.fn();
		render(KidsStep, { kids, oncontinue });
		await page.getByRole('button', { name: 'Continue' }).click();
		expect(oncontinue).toHaveBeenCalledOnce();
	});
});
