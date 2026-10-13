import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { archiveOriginalDefault } from '#lib/chore-duplicate.js';
import ArchiveOriginalOption from './ArchiveOriginalOption.svelte';

const checkbox = () =>
	page.getByRole('checkbox', { name: 'Archive the original when I save' });

describe('ArchiveOriginalOption.svelte', () => {
	it('is checked by default when the kind changes', async () => {
		render(ArchiveOriginalOption, {
			sourceTitle: 'Dishes',
			sourceKind: 'personal',
			kindChanges: true,
			checked: archiveOriginalDefault(true),
		});
		await expect.element(checkbox()).toBeChecked();
		await expect
			.element(page.getByText('The original is a personal chore.'))
			.toBeInTheDocument();
	});

	it('is unchecked for a plain duplicate', async () => {
		render(ArchiveOriginalOption, {
			sourceTitle: 'Dishes',
			sourceKind: 'personal',
			kindChanges: false,
			checked: archiveOriginalDefault(false),
		});
		await expect.element(checkbox()).not.toBeChecked();
		await expect.element(page.getByText(/separate copy/)).toBeInTheDocument();
	});

	it('can be toggled', async () => {
		render(ArchiveOriginalOption, {
			sourceTitle: 'Bathroom',
			sourceKind: 'rotation',
			kindChanges: true,
			checked: true,
		});
		await checkbox().click();
		await expect.element(checkbox()).not.toBeChecked();
		await checkbox().click();
		await expect.element(checkbox()).toBeChecked();
	});

	it('names the original in the heading', async () => {
		render(ArchiveOriginalOption, {
			sourceTitle: 'Bathroom',
			sourceKind: 'rotation',
			kindChanges: true,
		});
		await expect
			.element(page.getByText('Duplicating “Bathroom”'))
			.toBeVisible();
	});
});
