import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import StageListEditor from './StageListEditor.svelte';

const stages = () => [
	{ key: 'a', title: 'Clear counters', hint: 'Scrape plates', points: 0 },
	{ key: 'b', title: 'Load the machine', hint: '', points: 0 },
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

	it('shows what each stage pays and the total', async () => {
		render(StageListEditor, {
			stages: [
				{ key: 'a', title: 'One', hint: '', points: 17 },
				{ key: 'b', title: 'Two', hint: '', points: 3 },
			],
		});
		await expect.element(page.getByLabelText('Stage 1 points')).toHaveValue(17);
		await expect.element(page.getByLabelText('Stage 2 points')).toHaveValue(3);
		await expect
			.element(page.getByTestId('stage-points-total'))
			.toHaveTextContent('20 pts together');
	});

	it('splits the total evenly on request', async () => {
		render(StageListEditor, {
			stages: [
				{ key: 'a', title: 'One', hint: '', points: 17 },
				{ key: 'b', title: 'Two', hint: '', points: 3 },
			],
		});
		await page.getByRole('button', { name: 'Split 20 pts evenly' }).click();
		await expect.element(page.getByLabelText('Stage 1 points')).toHaveValue(10);
		await expect.element(page.getByLabelText('Stage 2 points')).toHaveValue(10);
		// Already even: nothing left to do.
		await expect
			.element(page.getByRole('button', { name: 'Split 20 pts evenly' }))
			.toBeDisabled();
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
