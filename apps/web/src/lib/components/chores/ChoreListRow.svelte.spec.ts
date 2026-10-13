import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ChoreListRow from './ChoreListRow.svelte';
import {
	bedroom,
	listMembers,
	mistake,
	oldChore,
	toilet,
} from './choresListFixtures.ts';

const props = { members: listMembers };

describe('ChoreListRow.svelte', () => {
	it('shows frequency, points, stages and the assignee of a personal chore', async () => {
		render(ChoreListRow, { ...props, chore: bedroom });
		await expect.element(page.getByText('Tidy Bedroom')).toBeVisible();
		await expect.element(page.getByText('Weekends')).toBeVisible();
		await expect.element(page.getByText('15 pts')).toBeVisible();
		await expect.element(page.getByText('2 stages')).toBeVisible();
		await expect.element(page.getByText('Mia')).toBeVisible();
	});

	it('shows the loop and whose turn it is on a rotation chore', async () => {
		render(ChoreListRow, { ...props, chore: toilet });
		await expect
			.element(page.getByTestId('loop'))
			.toHaveTextContent('Leo (turn), Mia');
	});

	it('marks the member in the individual grouping', async () => {
		render(ChoreListRow, {
			...props,
			chore: toilet,
			inRotation: true,
			theirTurn: true,
		});
		await expect.element(page.getByText('In rotation')).toBeVisible();
		await expect.element(page.getByText('Their turn')).toBeVisible();
	});

	it('links Duplicate as… to both kinds', async () => {
		render(ChoreListRow, { ...props, chore: bedroom });
		await page.getByText('Duplicate as…').click();
		await expect
			.element(page.getByRole('link', { name: 'Duplicate', exact: true }))
			.toHaveAttribute('href', '/chores/new?from=bedroom&kind=personal');
		await expect
			.element(page.getByRole('link', { name: 'Duplicate as rotation chore' }))
			.toHaveAttribute('href', '/chores/new?from=bedroom&kind=rotation');
	});

	it('disables the actions while busy', async () => {
		render(ChoreListRow, { ...props, chore: bedroom, busy: true });
		await expect
			.element(page.getByRole('button', { name: 'Archive Tidy Bedroom' }))
			.toBeDisabled();
	});

	it('offers Restore only on a completed archived chore', async () => {
		const onrestore = vi.fn();
		render(ChoreListRow, { ...props, chore: oldChore, onrestore });
		await page.getByRole('button', { name: 'Restore Feed Goldfish' }).click();
		expect(onrestore).toHaveBeenCalledWith('old');
		expect(
			page.getByRole('button', { name: /^Delete/ }).elements(),
		).toHaveLength(0);
		expect(page.getByRole('link', { name: /^Edit/ }).elements()).toHaveLength(
			0,
		);
	});

	it('needs a second press to delete a never-completed chore, and Cancel backs out', async () => {
		const ondelete = vi.fn();
		render(ChoreListRow, { ...props, chore: mistake, ondelete });
		await page
			.getByRole('button', { name: 'Delete Duplicate Test Chore' })
			.click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(ondelete).not.toHaveBeenCalled();
		await page
			.getByRole('button', { name: 'Delete Duplicate Test Chore' })
			.click();
		await page.getByRole('button', { name: /Confirm delete/ }).click();
		expect(ondelete).toHaveBeenCalledExactlyOnceWith('mistake');
	});
});
