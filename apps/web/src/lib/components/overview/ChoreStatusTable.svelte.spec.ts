import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ChoreStatusTable from './ChoreStatusTable.svelte';
import { overviewRows } from './fixtures.ts';

describe('ChoreStatusTable.svelte', () => {
	it('lists each chore with its context, assignee, status and points', async () => {
		render(ChoreStatusTable, { rows: overviewRows });
		await expect.element(page.getByText('3 open items')).toBeVisible();
		await expect
			.element(page.getByText('Shared Bathroom Toilet'))
			.toBeVisible();
		await expect
			.element(page.getByText('Household rotation • due today'))
			.toBeVisible();
		await expect.element(page.getByText('20 pts')).toBeVisible();
		await expect.element(page.getByText('Staged')).toBeVisible();
	});

	it('offers Skip and Remind on open rows, Reopen on done ones, View Loop only for loops', async () => {
		render(ChoreStatusTable, { rows: overviewRows, loopHref: '#' });
		expect(
			page.getByRole('button', { name: /^Skip / }).elements(),
		).toHaveLength(3);
		expect(
			page.getByRole('button', { name: /^Remind / }).elements(),
		).toHaveLength(3);
		expect(
			page.getByRole('button', { name: /^Reopen / }).elements(),
		).toHaveLength(2);
		expect(
			page.getByRole('link', { name: 'View Loop' }).elements(),
		).toHaveLength(1);
	});

	it('disables actions that have no handler', async () => {
		render(ChoreStatusTable, { rows: overviewRows });
		await expect
			.element(
				page.getByRole('button', { name: 'Skip Shared Bathroom Toilet' }),
			)
			.toBeDisabled();
	});

	it('runs an action for its row', async () => {
		const skip = vi.fn(async () => {});
		render(ChoreStatusTable, { rows: overviewRows, actions: { skip } });
		await page.getByRole('button', { name: 'Skip Run Dishwasher' }).click();
		expect(skip).toHaveBeenCalledWith(
			expect.objectContaining({ choreId: 'dishwasher' }),
		);
	});

	it('shows the error when an action fails', async () => {
		const reopen = vi.fn(async () => {
			throw new Error('Could not reopen this chore.');
		});
		render(ChoreStatusTable, { rows: overviewRows, actions: { reopen } });
		await page.getByRole('button', { name: 'Reopen Feed Dog' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Could not reopen this chore.');
	});

	it('says so when nothing is due', async () => {
		render(ChoreStatusTable, { rows: [] });
		await expect
			.element(page.getByText('No chores are due today.'))
			.toBeVisible();
		await expect.element(page.getByText('0 open items')).toBeVisible();
	});
});
