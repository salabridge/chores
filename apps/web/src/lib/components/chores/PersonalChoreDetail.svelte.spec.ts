import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import {
	roomDetail,
	roomDone,
	roomLastStage,
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

	it('is read only for anyone but the assignee', async () => {
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
});
