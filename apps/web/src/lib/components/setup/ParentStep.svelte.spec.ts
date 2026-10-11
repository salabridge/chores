import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

vi.mock('#lib/setup.remote.js', async () => {
	return await import('../../../../.storybook/mocks/setup-remote.ts');
});

import ParentStep from './ParentStep.svelte';

describe('ParentStep.svelte', () => {
	it('prefills the display name', async () => {
		render(ParentStep, { displayName: 'Mom' });
		await expect
			.element(page.getByLabelText('What should the kids call you?'))
			.toHaveValue('Mom');
	});

	it('offers every avatar colour, orange by default', async () => {
		render(ParentStep, { displayName: 'Mom' });
		await expect
			.element(page.getByRole('radio', { name: 'Orange' }))
			.toBeChecked();
		for (const colour of ['Blue', 'Green', 'Amber']) {
			await expect
				.element(page.getByRole('radio', { name: colour }))
				.toBeInTheDocument();
		}
	});

	it('shows Back only when there is a handler', async () => {
		const { container } = render(ParentStep, { displayName: 'Mom' });
		expect(container.textContent).not.toContain('Back');
	});

	it('calls onback', async () => {
		const onback = vi.fn();
		render(ParentStep, { displayName: 'Mom', onback });
		await page.getByRole('button', { name: 'Back' }).click();
		expect(onback).toHaveBeenCalledOnce();
	});
});
