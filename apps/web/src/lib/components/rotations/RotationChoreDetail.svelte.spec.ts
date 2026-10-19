import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { doerOptions } from '../chores/fixtures.ts';
import {
	dishwasherDetail,
	toiletDetail,
	toiletDone,
	toiletDoneFavour,
	toiletFavour,
	toiletWaiting,
} from './fixtures.ts';
import RotationChoreDetail from './RotationChoreDetail.svelte';

const handlers = () => ({
	oncomplete: vi.fn(async (_doneBy?: string) => {}),
	oncompletestage: vi.fn(async (_stageId: string, _doneBy?: string) => {}),
});

describe('RotationChoreDetail.svelte', () => {
	it('shows the title, points, loop and the three callouts', async () => {
		render(RotationChoreDetail, { detail: toiletDetail, ...handlers() });
		await expect
			.element(page.getByRole('heading', { name: 'Clean Bathroom Toilet' }))
			.toBeVisible();
		await expect.element(page.getByText('20 Points Reward')).toBeVisible();
		await expect
			.element(page.getByTestId('chore-schedule'))
			.toHaveTextContent('Weekly · Thu');
		await expect
			.element(page.getByText('The Kids Shared Bathroom Rotation Loop'))
			.toBeVisible();
		await expect.element(page.getByText('Done Last')).toBeVisible();
		await expect.element(page.getByText('Eligibility Rules')).toBeVisible();
		await expect
			.element(page.getByText('When the rotation advances'))
			.toBeVisible();
		await expect
			.element(page.getByText('How to complete this turn'))
			.toBeVisible();
		await expect
			.element(page.getByText(/Mom is excluded: parents are not part/))
			.toBeVisible();
	});

	it('completes the turn from the button', async () => {
		const h = handlers();
		render(RotationChoreDetail, { detail: toiletDetail, ...h });
		await page.getByRole('button', { name: 'Mark my turn done' }).click();
		expect(h.oncomplete).toHaveBeenCalledOnce();
		expect(h.oncompletestage).not.toHaveBeenCalled();
	});

	it('shows the error when completing fails and lets the member retry', async () => {
		const oncomplete = vi.fn(async () => {
			throw new Error('The turn has already moved on.');
		});
		render(RotationChoreDetail, {
			detail: toiletDetail,
			oncomplete,
			oncompletestage: vi.fn(async () => {}),
		});
		await page.getByRole('button', { name: 'Mark my turn done' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('The turn has already moved on.');
		await expect
			.element(page.getByRole('button', { name: 'Mark my turn done' }))
			.toBeEnabled();
	});

	it("hides the button and says whose turn it is when it isn't theirs", async () => {
		render(RotationChoreDetail, { detail: toiletWaiting, ...handlers() });
		await expect.element(page.getByText("It's Mia's turn.")).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it("banners another member's turn and lets the member take it", async () => {
		const h = handlers();
		render(RotationChoreDetail, { detail: toiletFavour, ...h });
		await expect.element(page.getByText("This is Mia's chore.")).toBeVisible();
		await page.getByRole('button', { name: 'Mark my turn done' }).click();
		expect(h.oncomplete).toHaveBeenCalledWith(undefined);
	});

	it('lets a parent record who did the turn, starting on the turn-holder', async () => {
		const h = handlers();
		render(RotationChoreDetail, {
			detail: toiletFavour,
			doerOptions,
			...h,
		});
		await expect.element(page.getByLabelText('Done by')).toHaveValue('mia');
		await page.getByLabelText('Done by').selectOptions('dad');
		await page.getByRole('button', { name: 'Mark my turn done' }).click();
		expect(h.oncomplete).toHaveBeenCalledWith('dad');
	});

	it('shows who did a finished turn when it was not the turn-holder', async () => {
		render(RotationChoreDetail, { detail: toiletDoneFavour, ...handlers() });
		await expect.element(page.getByText('Done by Leo')).toBeVisible();
	});

	it('says the turn is done and offers no button afterwards', async () => {
		render(RotationChoreDetail, { detail: toiletDone, ...handlers() });
		await expect.element(page.getByText('Turn complete')).toBeVisible();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('shows the stage checklist and checks off the current stage', async () => {
		const h = handlers();
		render(RotationChoreDetail, { detail: dishwasherDetail, ...h });
		await expect.element(page.getByText('Load the dishwasher')).toBeVisible();
		await expect.element(page.getByText('Current stage')).toBeVisible();
		await page.getByRole('button', { name: 'Finish stage 2 of 3' }).click();
		expect(h.oncompletestage).toHaveBeenCalledWith('s2', undefined);
		expect(h.oncomplete).not.toHaveBeenCalled();
	});

	it('shows a placeholder for Done Last when nobody has gone yet', async () => {
		render(RotationChoreDetail, {
			detail: { ...toiletDetail, doneLast: null },
			...handlers(),
		});
		await expect.element(page.getByText('Nobody yet')).toBeVisible();
	});
});
