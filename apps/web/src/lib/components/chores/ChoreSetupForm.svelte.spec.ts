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

	describe('edit mode', () => {
		const saved = (over: Partial<ChoreDraft> = {}): ChoreDraft => ({
			...exampleDraft(),
			kind: 'personal',
			title: 'Run Dishwasher',
			assigneeId: 'leo',
			stages: exampleDraft().stages.map((s, i) => ({ ...s, id: `s${i + 1}` })),
			...over,
		});
		const edit = (draft: ChoreDraft, onsubmit = vi.fn()) => {
			render(Host, {
				draft,
				members: householdMembers,
				onsubmit,
				cancelHref: '#',
				mode: 'edit',
			});
			return onsubmit;
		};

		it('loads the current values and offers Save Changes', async () => {
			edit(saved());
			await expect
				.element(page.getByLabelText('Chore Title'))
				.toHaveValue('Run Dishwasher');
			await expect
				.element(page.getByLabelText('Stage 1 title'))
				.toHaveValue('Clear the counter');
			await expect
				.element(page.getByRole('radio', { name: 'Leo' }))
				.toBeChecked();
			await expect
				.element(page.getByRole('button', { name: 'Save Changes' }))
				.toBeVisible();
			expect(
				page.getByRole('button', { name: 'Create Chore' }).elements(),
			).toHaveLength(0);
		});

		it('shows the type read-only', async () => {
			edit(saved());
			await expect
				.element(page.getByTestId('chore-kind'))
				.toHaveTextContent('Personal Chore');
			expect(
				page.getByRole('radio', { name: 'Personal Chore' }).elements(),
			).toHaveLength(0);
			expect(
				page.getByRole('radio', { name: 'Household Rotation' }).elements(),
			).toHaveLength(0);
		});

		it('sends rotation membership to the Rotation Builder', async () => {
			const onsubmit = edit(saved({ kind: 'rotation', assigneeId: null }));
			await expect
				.element(page.getByRole('link', { name: 'Open Rotations' }))
				.toHaveAttribute('href', '/rotations');
			expect(page.getByTestId('rotation-preview').elements()).toHaveLength(0);
			await page.getByRole('button', { name: 'Save Changes' }).click();
			await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledOnce());
			expect(onsubmit.mock.calls[0][0]).toMatchObject({ kind: 'rotation' });
		});

		it('submits the edits with the stage ids intact', async () => {
			const onsubmit = edit(saved());
			await page.getByLabelText('Chore Title').fill('Load Dishwasher');
			await page.getByRole('button', { name: 'Move stage 2 up' }).click();
			await page.getByRole('button', { name: 'Remove stage 3' }).click();
			await page.getByRole('button', { name: 'Save Changes' }).click();
			await vi.waitFor(() => expect(onsubmit).toHaveBeenCalledOnce());
			const sent = onsubmit.mock.calls[0][0] as ChoreDraft;
			expect(sent.title).toBe('Load Dishwasher');
			expect(sent.stages.map((s) => s.id)).toEqual(['s2', 's1']);
		});

		it('shows the server message when the chore is stale', async () => {
			const onsubmit = vi
				.fn()
				.mockRejectedValue(
					new Error(
						'This chore was changed by someone else. Reload to see their changes.',
					),
				);
			edit(saved(), onsubmit);
			await page.getByRole('button', { name: 'Save Changes' }).click();
			await expect
				.element(
					page.getByText('This chore was changed by someone else.', {
						exact: false,
					}),
				)
				.toBeVisible();
		});
	});
});
