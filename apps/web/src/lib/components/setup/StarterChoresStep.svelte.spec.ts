import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/setup.remote.js', async () => {
	return await import('../../../../.storybook/mocks/setup-remote.ts');
});

import { STARTER_CHORES } from '#lib/setup.js';
import StarterChoresStep from './StarterChoresStep.svelte';

const kids = [
	{ id: 'k1', displayName: 'Mia' },
	{ id: 'k2', displayName: 'Leo' },
];

describe('StarterChoresStep.svelte', () => {
	it('offers every preset, unchecked', async () => {
		render(StarterChoresStep, { kids });
		for (const chore of STARTER_CHORES) {
			await expect
				.element(page.getByRole('checkbox', { name: new RegExp(chore.title) }))
				.not.toBeChecked();
		}
	});

	it('assigns to every kid by default', async () => {
		render(StarterChoresStep, { kids });
		await expect
			.element(page.getByRole('checkbox', { name: 'Mia' }))
			.toBeChecked();
		await expect
			.element(page.getByRole('checkbox', { name: 'Leo' }))
			.toBeChecked();
	});

	it('can finish or skip', async () => {
		render(StarterChoresStep, { kids });
		await expect
			.element(page.getByRole('button', { name: 'Finish setup' }))
			.toBeVisible();
		const skip = page.getByRole('button', { name: 'Skip for now' });
		await expect.element(skip).toHaveAttribute('name', 'skip');
	});
});
