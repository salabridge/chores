import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ExceptionsNotesPanel from './ExceptionsNotesPanel.svelte';
import { overviewNotes } from './fixtures.ts';

describe('ExceptionsNotesPanel.svelte', () => {
	it('lists the notes and counts only exclusion rules in the badge', async () => {
		const { container } = render(ExceptionsNotesPanel, {
			notes: overviewNotes,
		});
		await expect.element(page.getByText('1 active rule')).toBeVisible();
		await expect
			.element(
				page.getByText('Mia is excluded from Run Dishwasher: too young.'),
			)
			.toBeVisible();
		await expect
			.element(page.getByText('Feed Dog is done, so Leo is up next.'))
			.toBeVisible();
		for (const tone of ['warning', 'info', 'success']) {
			expect(container.querySelector(`[data-tone="${tone}"]`)).not.toBeNull();
		}
	});

	it('has an empty state', async () => {
		render(ExceptionsNotesPanel, { notes: [] });
		await expect.element(page.getByText('0 active rules')).toBeVisible();
		await expect.element(page.getByText(/Nothing to flag/)).toBeVisible();
	});
});
