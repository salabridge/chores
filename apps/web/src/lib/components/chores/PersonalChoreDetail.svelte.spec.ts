import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import {
	doerOptions,
	roomDetail,
	roomDone,
	roomDoneFavour,
	roomFavour,
	roomLastStage,
	roomPendingFavour,
	roomReadOnly,
	singleStepDetail,
} from './fixtures.ts';
import PersonalChoreDetail from './PersonalChoreDetail.svelte';

// The real remote file imports server code, which can't load in the browser.
// Storybook fakes the same `form()` surface, so the spec reuses that stand-in.
vi.mock(
	'#lib/personal-detail.remote.js',
	() => import('../../../../.storybook/mocks/personal-detail-remote.ts'),
);

describe('PersonalChoreDetail.svelte', () => {
	it('shows the title, reward, parent note and progress', async () => {
		render(PersonalChoreDetail, { detail: roomDetail });
		await expect
			.element(page.getByRole('heading', { name: 'Clean Your Room' }))
			.toBeVisible();
		await expect.element(page.getByText('15 Points Reward')).toBeVisible();
		await expect
			.element(page.getByTestId('chore-schedule'))
			.toHaveTextContent('Daily');
		await expect
			.element(page.getByText(/Break your room clean into three quick stages/))
			.toBeVisible();
		await expect
			.element(page.getByText('Clean Your Room Progress'))
			.toBeVisible();
		await expect
			.element(page.getByText('Stage 2 of 3 is active right now'))
			.toBeVisible();
		await expect.element(page.getByText('1 / 3 done')).toBeVisible();
	});

	it('lists the stages as completed, current and locked', async () => {
		render(PersonalChoreDetail, { detail: roomDetail });
		await expect.element(page.getByText('Completed')).toBeVisible();
		await expect.element(page.getByText('Current stage')).toBeVisible();
		await expect
			.element(page.getByText('Remaining after this stage'))
			.toBeVisible();
		await expect
			.element(page.getByText('Stage 3: Vacuum the carpet'))
			.toBeVisible();
	});

	it('explains what happens next and the reward footer', async () => {
		render(PersonalChoreDetail, { detail: roomDetail });
		await expect.element(page.getByText('What happens next')).toBeVisible();
		await expect
			.element(page.getByText(/Finish Stage 2 to unlock Stage 3/))
			.toBeVisible();
		await expect
			.element(page.getByText('Reward after all 3 stages · 15 pts'))
			.toBeVisible();
	});

	it('posts the current stage from a real form, so it works without JavaScript', async () => {
		render(PersonalChoreDetail, { detail: roomDetail });
		const button = page.getByRole('button', { name: 'Complete Stage 2' });
		await expect.element(button).toBeVisible();
		const form = button.element().closest('form');
		expect(form?.method).toBe('post');
		const hidden = [...(form?.querySelectorAll('input[type=hidden]') ?? [])];
		const values = Object.fromEntries(
			hidden.map((i) => [
				(i as HTMLInputElement).name,
				(i as HTMLInputElement).value,
			]),
		);
		expect(Object.values(values)).toContain('s2');
		expect(Object.values(values)).toContain('chore-room');
	});

	it('says "Complete Chore" on the last stage', async () => {
		render(PersonalChoreDetail, { detail: roomLastStage });
		await expect
			.element(page.getByRole('button', { name: 'Complete Chore' }))
			.toBeVisible();
	});

	it('shows one "Mark Done" button and no stage list for a single-step chore', async () => {
		render(PersonalChoreDetail, { detail: singleStepDetail });
		await expect
			.element(page.getByRole('button', { name: 'Mark Done' }))
			.toBeVisible();
		expect(page.getByRole('list').elements()).toHaveLength(0);
		expect(page.getByRole('progressbar').elements()).toHaveLength(0);
	});

	it("banners someone else's open chore and lets the member do it for them", async () => {
		render(PersonalChoreDetail, { detail: roomFavour });
		await expect.element(page.getByText("This is Mia's chore.")).toBeVisible();
		await expect
			.element(page.getByText('Mia approves it, then you get the points.'))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Complete Stage 2' }))
			.toBeVisible();
		expect(page.getByLabelText('Done by').elements()).toHaveLength(0);
	});

	it("has no banner on the member's own chore", async () => {
		render(PersonalChoreDetail, { detail: roomDetail });
		expect(page.getByTestId('favour-banner').elements()).toHaveLength(0);
	});

	it('offers a parent a "Done by" select that starts on the assignee', async () => {
		render(PersonalChoreDetail, { detail: roomFavour, doerOptions });
		await expect.element(page.getByLabelText('Done by')).toHaveValue('mia');
		await expect
			.element(page.getByText('Choose who did it below. They get the points.'))
			.toBeVisible();
	});

	it('posts the chosen doer with the form', async () => {
		render(PersonalChoreDetail, { detail: roomFavour, doerOptions });
		await page.getByLabelText('Done by').selectOptions('dad');
		const form = page
			.getByRole('button', { name: 'Complete Stage 2' })
			.element()
			.closest('form');
		expect(
			(form?.elements.namedItem('doneBy') as HTMLSelectElement | null)?.value,
		).toBe('dad');
	});

	it('shows who did a finished chore when it was not the assignee', async () => {
		render(PersonalChoreDetail, { detail: roomDoneFavour });
		await expect.element(page.getByText('Done by Leo')).toBeVisible();
	});

	it('is read only for anyone but the assignee when it is not open', async () => {
		render(PersonalChoreDetail, { detail: roomReadOnly });
		await expect
			.element(page.getByText(/Only Mia can complete this chore/))
			.toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('shows a finished chore without a button', async () => {
		render(PersonalChoreDetail, { detail: roomDone });
		await expect.element(page.getByText('Chore complete')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	const favourProps = () => ({
		favourActions: {
			approve: vi.fn(async (_id: string) => {}),
			decline: vi.fn(async (_id: string) => {}),
			askParent: vi.fn(async (_id: string) => {}),
		},
	});

	it('asks the owner to approve a pending favour instead of offering Mark Done', async () => {
		const p = favourProps();
		render(PersonalChoreDetail, {
			detail: { ...roomPendingFavour, isAssignee: true },
			viewer: { id: 'mia', isParent: false },
			...p,
		});
		await expect
			.element(page.getByTestId('favour-approval'))
			.toHaveTextContent('Leo says they did');
		expect(
			page.getByRole('button', { name: 'Mark Done' }).elements(),
		).toHaveLength(0);
		await page.getByRole('button', { name: 'Not done' }).click();
		expect(p.favourActions.decline).toHaveBeenCalledWith('c1');
	});

	it('shows the doer that it waits for the owner, with Ask a parent', async () => {
		const p = favourProps();
		render(PersonalChoreDetail, {
			detail: roomPendingFavour,
			viewer: { id: 'leo', isParent: false },
			...p,
		});
		await expect.element(page.getByText('Waiting for Mia')).toBeVisible();
		await page.getByRole('button', { name: 'Ask a parent' }).click();
		expect(p.favourActions.askParent).toHaveBeenCalledWith('c1');
	});
});
