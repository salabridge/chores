import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import {
	type ChoreDraft,
	emptyDraft,
	exampleDraft,
} from '#lib/chore-creator.js';
import Host from './ChoreSetupForm.host.svelte';
import { householdMembers } from './fixtures.ts';

const setup = (draft: ChoreDraft = emptyDraft(), onsubmit = vi.fn()) => {
	render(Host, {
		draft,
		members: householdMembers,
		onsubmit,
		cancelHref: '#',
	});
	return onsubmit;
};

describe('ChoreSetupForm.svelte', () => {
	it('renders the five steps', async () => {
		setup();
		for (const name of [
			'1. Define the chore',
			'2. Choose chore type',
			'3. Add stages if needed',
			'4. Choose frequency and points',
			'5. Select assignee',
		]) {
			await expect.element(page.getByRole('heading', { name })).toBeVisible();
		}
	});

	it('blocks submit and shows the problems when required fields are empty', async () => {
		const onsubmit = setup();
		await page.getByRole('button', { name: 'Create Chore' }).click();
		await expect
			.element(page.getByText('Give the chore a title.'))
			.toBeVisible();
		await expect
			.element(page.getByText('Choose who this chore belongs to.'))
			.toBeVisible();
		expect(onsubmit).not.toHaveBeenCalled();
	});

	it('submits a valid personal chore', async () => {
		const onsubmit = setup();
		await page.getByLabelText('Chore Title').fill('Run Dishwasher');
		await page.getByRole('radio', { name: 'Leo' }).click();
		await page.getByRole('radio', { name: '15', exact: true }).click();
		await page.getByRole('button', { name: 'Create Chore' }).click();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledOnce());
		expect(onsubmit.mock.calls[0][0]).toMatchObject({
			title: 'Run Dishwasher',
			kind: 'personal',
			assigneeId: 'leo',
			points: 15,
		});
	});

	it('shows the frequency and points summary', async () => {
		setup();
		await page.getByRole('radio', { name: 'Weekends' }).click();
		await page.getByRole('radio', { name: '20', exact: true }).click();
		await expect.element(page.getByText('Weekends • 20 pts')).toBeVisible();
	});

	it('requires a stage once stages are on, with no points input', async () => {
		setup();
		await page.getByRole('radio', { name: 'Use Stages' }).click();
		await expect.element(page.getByLabelText('Stage 1 title')).toBeVisible();
		expect(page.getByLabelText(/stage 1 points/i).elements()).toHaveLength(0);
		await page.getByRole('button', { name: 'Remove stage 1' }).click();
		await page.getByRole('button', { name: 'Create Chore' }).click();
		await expect
			.element(
				page.getByText('Add at least one stage, or switch to Single Step.'),
			)
			.toBeVisible();
	});

	it('adds and reorders stages', async () => {
		setup(exampleDraft());
		await page.getByRole('button', { name: 'Add stage' }).click();
		await expect.element(page.getByLabelText('Stage 4 title')).toBeVisible();
		await page.getByRole('button', { name: 'Move stage 2 up' }).click();
		await expect
			.element(page.getByLabelText('Stage 1 title'))
			.toHaveValue('Wipe the sink and mirror');
	});

	it('switches to the rotation flow and previews the order', async () => {
		const onsubmit = setup({ ...emptyDraft(), title: 'Trash' });
		await page
			.getByRole('radio', { name: 'Household Rotation' })
			.first()
			.click();
		await expect.element(page.getByText('Rotation Preview')).toBeVisible();
		await expect.element(page.getByText('Mom → Dad → Leo → Mia')).toBeVisible();
		// Both type choices stay in sync.
		await expect
			.element(page.getByRole('radio', { name: 'Household Rotation' }).last())
			.toBeChecked();
		await page.getByRole('button', { name: 'Continue to Eligibility' }).click();
		await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledOnce());
		expect(onsubmit.mock.calls[0][0]).toMatchObject({ kind: 'rotation' });
	});

	it('shows the error when saving fails', async () => {
		const onsubmit = vi.fn().mockRejectedValue(new Error('Server said no.'));
		setup({ ...emptyDraft(), title: 'Trash', assigneeId: 'mom' }, onsubmit);
		await page.getByRole('button', { name: 'Create Chore' }).click();
		await expect.element(page.getByText('Server said no.')).toBeVisible();
	});
});
