import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import WorkspaceHeader from './WorkspaceHeader.svelte';

describe('WorkspaceHeader.svelte', () => {
	it('renders the title and subtitle', async () => {
		render(WorkspaceHeader, {
			title: 'Household Overview',
			subtitle: 'Start here.',
		});
		await expect
			.element(page.getByRole('heading', { name: 'Household Overview' }))
			.toBeVisible();
		await expect.element(page.getByText('Start here.')).toBeVisible();
	});

	it('renders the actions snippet', async () => {
		render(WorkspaceHeader, {
			title: 'T',
			actions: createRawSnippet(() => ({
				render: () => '<button type="button">Do it</button>',
			})),
		});
		await expect
			.element(page.getByRole('button', { name: 'Do it' }))
			.toBeVisible();
	});
});
