import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ChoresList from './ChoresList.svelte';
import { allChores, listMembers, orphan } from './choresListFixtures.ts';

const props = { chores: allChores, members: listMembers };

const rowTitles = () =>
	page
		.getByRole('heading', { level: 3 })
		.elements()
		.map((h) => h.textContent?.trim());

describe('ChoresList.svelte', () => {
	it('groups by rotation: a section per rotation chore, then personal chores', async () => {
		render(ChoresList, props);
		await expect
			.element(page.getByRole('heading', { name: 'Personal chores' }))
			.toBeVisible();
		expect(page.getByTestId('rotation-section').elements()).toHaveLength(2);
		await expect
			.element(page.getByText('Rotates between Leo, Mia', { exact: true }))
			.toBeVisible();
		await expect
			.element(page.getByTestId('loop').first())
			.toHaveTextContent('Leo (turn), Mia');
		// 2 rotations + 3 personal, each once; archived chores are hidden.
		expect(rowTitles()).toHaveLength(5);
		expect(rowTitles()).not.toContain('Feed Goldfish');
	});

	it('groups by individual: kids first, rotations marked per member', async () => {
		render(ChoresList, { ...props, grouping: 'individual' });
		const sections = page.getByTestId('member-section').elements();
		expect(
			sections.map((s) => s.querySelector('h2')?.textContent?.trim()),
		).toEqual(['Leo', 'Mia', 'Mom']);
		await expect.element(page.getByText('Their turn').first()).toBeVisible();
		// Toilet is in Leo's and Mia's sections, dishwasher in three.
		expect(page.getByText('In rotation').elements()).toHaveLength(5);
		expect(page.getByText('Their turn').elements()).toHaveLength(2);
	});

	it('shows chores whose assignee is gone under Unassigned', async () => {
		render(ChoresList, {
			chores: [...allChores, orphan],
			members: listMembers,
			grouping: 'individual',
		});
		await expect.element(page.getByTestId('unassigned-section')).toBeVisible();
	});

	it('switches grouping from the chips and reports it through the binding', async () => {
		render(ChoresList, props);
		await page
			.getByRole('radio', { name: 'Individual' })
			.click({ force: true });
		await expect
			.element(page.getByTestId('member-section').first())
			.toBeVisible();
		expect(page.getByTestId('rotation-section').elements()).toHaveLength(0);
	});

	it('offers Edit, Duplicate as and Archive on active rows', async () => {
		const onarchive = vi.fn();
		render(ChoresList, { ...props, onarchive });
		await expect
			.element(page.getByRole('link', { name: 'Edit Tidy Bedroom' }))
			.toHaveAttribute('href', '/chores/bedroom/edit');
		await page.getByText('Duplicate as…').first().click();
		await expect
			.element(
				page.getByRole('link', { name: 'Duplicate', exact: true }).first(),
			)
			.toHaveAttribute('href', expect.stringContaining('/chores/new?from='));
		await page.getByRole('button', { name: 'Archive Tidy Bedroom' }).click();
		expect(onarchive).toHaveBeenCalledWith('bedroom');
	});

	it('lists archived chores behind the filter, with Restore and Delete', async () => {
		const onrestore = vi.fn();
		const ondelete = vi.fn();
		render(ChoresList, { ...props, onrestore, ondelete });
		await page.getByRole('switch', { name: 'Show archived chores' }).click();
		await expect.element(page.getByTestId('archived-section')).toBeVisible();
		expect(rowTitles()).toEqual(['Feed Goldfish', 'Duplicate Test Chore']);

		await page.getByRole('button', { name: 'Restore Feed Goldfish' }).click();
		expect(onrestore).toHaveBeenCalledWith('old');

		// A completed chore can only be restored; the never-completed one can be deleted.
		expect(
			page.getByRole('button', { name: 'Delete Feed Goldfish' }).elements(),
		).toHaveLength(0);
		await page
			.getByRole('button', { name: 'Delete Duplicate Test Chore' })
			.click();
		expect(ondelete).not.toHaveBeenCalled();
		await page
			.getByRole('button', { name: 'Confirm delete Duplicate Test Chore' })
			.click();
		expect(ondelete).toHaveBeenCalledWith('mistake');
	});

	it('shows an action error', async () => {
		render(ChoresList, {
			...props,
			error:
				'This chore has been completed, so it can’t be deleted. Archive it instead.',
		});
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Archive it instead');
	});

	it('shows an empty state linking to Create & Assign', async () => {
		render(ChoresList, { chores: [], members: listMembers });
		await expect.element(page.getByText('No chores yet')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Create & Assign' }))
			.toHaveAttribute('href', '/chores/new');
	});
});
