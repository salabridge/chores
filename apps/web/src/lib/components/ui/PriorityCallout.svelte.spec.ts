import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PriorityCallout from './PriorityCallout.svelte';

describe('PriorityCallout.svelte', () => {
	it('renders title and body', async () => {
		const children = createRawSnippet(() => ({
			render: () => '<span>Complete these first.</span>',
		}));
		render(PriorityCallout, { title: 'Priority loop first', children });
		await expect.element(page.getByRole('note')).toBeVisible();
		await expect.element(page.getByText('Priority loop first')).toBeVisible();
		await expect.element(page.getByText('Complete these first.')).toBeVisible();
	});

	it('renders an icon override in the tile', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<span data-testid="custom">x</span>',
		}));
		render(PriorityCallout, { title: 'T', icon });
		await expect.element(page.getByTestId('custom')).toBeVisible();
	});
});
