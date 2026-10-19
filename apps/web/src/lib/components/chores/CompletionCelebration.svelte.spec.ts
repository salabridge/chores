import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import CompletionCelebration from './CompletionCelebration.svelte';
import {
	favourCompletion,
	goalReachedCompletion,
	roomCompletion,
	toiletCompletion,
} from './fixtures.ts';

describe('CompletionCelebration.svelte', () => {
	it('celebrates the member and names the rotation hand-off', async () => {
		render(CompletionCelebration, { summary: toiletCompletion });
		await expect
			.element(page.getByRole('heading', { name: 'Nice work, Leo!' }))
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					'Clean Bathroom Toilet is complete, and the rotation has moved to Mia.',
				),
			)
			.toBeVisible();
	});

	it('summarises the chore, the points and the new total', async () => {
		render(CompletionCelebration, { summary: toiletCompletion });
		await expect.element(page.getByText('Completed')).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Clean Bathroom Toilet' }))
			.toBeVisible();
		await expect.element(page.getByText('Shared rotation')).toBeVisible();
		await expect.element(page.getByText('Next up: Mia')).toBeVisible();
		await expect.element(page.getByText('+20 pts')).toBeVisible();
		await expect
			.element(page.getByText('Your total is now 160 pts.'))
			.toBeVisible();
	});

	it('shows the weekly goal progress', async () => {
		render(CompletionCelebration, { summary: toiletCompletion });
		await expect.element(page.getByText('Weekly Goal Progress')).toBeVisible();
		await expect
			.element(page.getByText('160 / 200 Points reached'))
			.toBeVisible();
		await expect
			.element(page.getByText('40 points left before the next reward unlock.'))
			.toBeVisible();
		await expect
			.element(page.getByRole('progressbar'))
			.toHaveAttribute('aria-valuenow', '80');
	});

	it('drops the rotation tags for a personal chore', async () => {
		render(CompletionCelebration, { summary: roomCompletion });
		await expect
			.element(page.getByText('Clean Your Room is complete.'))
			.toBeVisible();
		await expect.element(page.getByText('+15 pts')).toBeVisible();
		expect(page.getByText('Shared rotation').elements()).toHaveLength(0);
		expect(page.getByText(/Next up/).elements()).toHaveLength(0);
	});

	it("says the points are the member's and whose chore is covered", async () => {
		render(CompletionCelebration, { summary: favourCompletion });
		await expect
			.element(page.getByTestId('done-for'))
			.toHaveTextContent("+10 points for you. Mia's chore is covered");
		await expect.element(page.getByText('+10 pts')).toBeVisible();
	});

	it('has no favour line for a chore of their own', async () => {
		render(CompletionCelebration, { summary: roomCompletion });
		expect(page.getByTestId('done-for').elements()).toHaveLength(0);
	});

	it('says when the weekly goal is reached', async () => {
		render(CompletionCelebration, { summary: goalReachedCompletion });
		await expect
			.element(page.getByText('Weekly goal reached. Great job!'))
			.toBeVisible();
	});

	it('links back to Today', async () => {
		render(CompletionCelebration, { summary: roomCompletion });
		await expect
			.element(page.getByRole('link', { name: 'Back to Today' }))
			.toHaveAttribute('href', '/today');
	});
});
