import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import StageListEditor from './StageListEditor.svelte';

const stages = () => [
	{ key: 'a', title: 'Clear counters', hint: 'Scrape plates' },
	{ key: 'b', title: 'Load the machine', hint: '' },
];

describe('StageListEditor.svelte', () => {
	it('numbers the stages and shows title and hint fields', async () => {
		render(StageListEditor, { stages: stages() });
		await expect
			.element(page.getByLabelText('Stage 1 title'))
			.toHaveValue('Clear counters');
		await expect
			.element(page.getByLabelText('Stage 1 hint (optional)'))
			.toHaveValue('Scrape plates');
		await expect.element(page.getByLabelText('Stage 2 title')).toBeVisible();
	});

	it('removes a stage', async () => {
		render(StageListEditor, { stages: stages() });
		await page.getByRole('button', { name: 'Remove stage 1' }).click();
		await expect
			.element(page.getByLabelText('Stage 1 title'))
			.toHaveValue('Load the machine');
	});

	it('disables the end moves', async () => {
		render(StageListEditor, { stages: stages() });
		await expect
			.element(page.getByRole('button', { name: 'Move stage 1 up' }))
			.toBeDisabled();
		await expect
			.element(page.getByRole('button', { name: 'Move stage 2 down' }))
			.toBeDisabled();
	});

	it('shows problems', async () => {
		render(StageListEditor, {
			stages: stages(),
			errors: { b: { title: 'Give this stage a title.' } },
			listError: 'Add at least one stage, or switch to Single Step.',
		});
		await expect
			.element(page.getByText('Give this stage a title.'))
			.toBeVisible();
		await expect
			.element(
				page.getByText('Add at least one stage, or switch to Single Step.'),
			)
			.toBeVisible();
	});
});
