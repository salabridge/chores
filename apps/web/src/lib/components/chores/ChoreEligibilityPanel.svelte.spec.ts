import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { emptyDraft, exampleDraft } from '#lib/chore-creator.js';
import type { CreateRotationChoreInput } from '#lib/chore-eligibility.js';
import ChoreEligibilityPanel from './ChoreEligibilityPanel.svelte';
import { householdMembers } from './fixtures.ts';

const setup = (
	props: Partial<{
		draft: ReturnType<typeof exampleDraft>;
		active: boolean;
		onsave: (input: CreateRotationChoreInput) => Promise<void>;
	}> = {},
) => {
	const onsave = vi.fn(props.onsave ?? (async () => {}));
	render(ChoreEligibilityPanel, {
		draft: exampleDraft(),
		members: householdMembers,
		active: true,
		...props,
		onsave,
	});
	return onsave;
};

const save = () =>
	page.getByRole('button', { name: 'Create Household Rotation' });

describe('ChoreEligibilityPanel.svelte', () => {
	it('lists every member as eligible by default, with the summary', async () => {
		setup();
		await expect
			.element(
				page.getByText(
					'Household rotations need at least two eligible members. This chore currently has 4 eligible and 0 excluded.',
				),
			)
			.toBeVisible();
		for (const name of ['Mom', 'Dad', 'Leo', 'Mia']) {
			await expect.element(page.getByRole('switch', { name })).toBeChecked();
		}
		await expect
			.element(page.getByText('Chore type: Household Rotation'))
			.toBeVisible();
		await expect
			.element(page.getByText('Frequency: Daily • 15 pts'))
			.toBeVisible();
		await expect
			.element(page.getByText('Stages: 3 stages, 15 total points'))
			.toBeVisible();
		await expect
			.element(page.getByText('Eligibility: 4 members eligible, 0 excluded'))
			.toBeVisible();
	});

	it('asks for a reason when a member is excluded, and shows it as their status and a warning', async () => {
		setup();
		await page.getByRole('switch', { name: 'Mia' }).click();
		await expect
			.element(page.getByText('Add a reason for excluding them.'))
			.toBeVisible();
		await expect.element(save()).toBeDisabled();
		await page
			.getByLabelText('Reason for excluding Mia')
			.fill('Too young for hot-water handling');
		await expect
			.element(
				page.getByText('Mia stays excluded: Too young for hot-water handling.'),
			)
			.toBeVisible();
		await expect
			.element(
				page.getByText('This chore currently has 3 eligible and 1 excluded.', {
					exact: false,
				}),
			)
			.toBeVisible();
		await expect.element(save()).toBeEnabled();
	});

	it('blocks saving with fewer than two eligible members', async () => {
		setup();
		for (const name of ['Dad', 'Leo', 'Mia']) {
			await page.getByRole('switch', { name }).click();
			await page
				.getByLabelText(`Reason for excluding ${name}`)
				.fill('Not this one');
		}
		await expect
			.element(page.getByText(/Keep at least 2 members eligible/))
			.toBeVisible();
		await expect.element(save()).toBeDisabled();
	});

	it('reorders with the shared control and saves the order shown', async () => {
		const onsave = setup();
		await page.getByRole('button', { name: 'Move Mom down' }).click();
		await save().click();
		expect(onsave).toHaveBeenCalledTimes(1);
		const input = onsave.mock.calls[0][0];
		expect(input.chore.title).toBe('Bathroom Rotation');
		expect(input.chore.kind).toBe('rotation');
		expect(input.members.map((m) => m.memberId)).toEqual([
			'dad',
			'mom',
			'leo',
			'mia',
		]);
		expect(input.members.map((m) => m.position)).toEqual([1, 2, 3, 4]);
	});

	it('sends exclusion reasons trimmed, only on excluded members', async () => {
		const onsave = setup();
		await page.getByRole('switch', { name: 'Mia' }).click();
		await page.getByLabelText('Reason for excluding Mia').fill('  Too young  ');
		await save().click();
		const mia = onsave.mock.calls[0][0].members.find(
			(m) => m.memberId === 'mia',
		);
		expect(mia).toMatchObject({
			eligible: false,
			exclusionReason: 'Too young',
		});
		expect(
			onsave.mock.calls[0][0].members.filter((m) => m.exclusionReason),
		).toHaveLength(1);
	});

	it('shows the error when saving fails', async () => {
		setup({
			onsave: async () => {
				throw new Error('The household members changed.');
			},
		});
		await save().click();
		await expect
			.element(page.getByTestId('save-error'))
			.toHaveTextContent('The household members changed.');
	});

	it('cannot save before the setup form is continued', async () => {
		setup({ active: false });
		await expect.element(save()).toBeDisabled();
	});

	it('cannot save while the chore setup is incomplete', async () => {
		setup({ draft: { ...exampleDraft(), title: '' } });
		await expect.element(save()).toBeDisabled();
		await expect
			.element(
				page.getByText(
					'The chore setup needs attention. Fix it on the left, then save.',
				),
			)
			.toBeVisible();
	});

	it('has nothing to set up for a personal chore', async () => {
		setup({ draft: emptyDraft('personal') });
		await expect
			.element(page.getByText(/nothing to set up here/))
			.toBeVisible();
		await expect.element(save()).not.toBeInTheDocument();
	});
});
