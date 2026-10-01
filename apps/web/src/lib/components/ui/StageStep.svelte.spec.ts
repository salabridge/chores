import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import StageStep from './StageStep.svelte';

describe('StageStep.svelte', () => {
	describe('checklist variant', () => {
		it('shows the title and default status for a completed stage', async () => {
			render(StageStep, { state: 'completed', title: 'Put away toys' });
			await expect.element(page.getByText('Put away toys')).toBeVisible();
			await expect.element(page.getByText('Completed')).toBeVisible();
			await expect
				.element(page.getByRole('listitem'))
				.toHaveAttribute('data-state', 'completed');
		});

		it('marks the current stage with aria-current="step"', async () => {
			render(StageStep, { state: 'current', title: 'Dust surfaces' });
			const item = page.getByRole('listitem');
			await expect.element(item).toHaveAttribute('aria-current', 'step');
			await expect.element(page.getByText('Current stage')).toBeVisible();
		});

		it('dims a locked stage and shows the remaining status', async () => {
			render(StageStep, { state: 'locked', title: 'Vacuum' });
			const item = page.getByRole('listitem');
			await expect.element(item).not.toHaveAttribute('aria-current');
			await expect.element(item).toHaveClass('opacity-60');
			await expect
				.element(page.getByText('Remaining after this stage'))
				.toBeVisible();
		});

		it('lets a custom status override the default', async () => {
			render(StageStep, {
				state: 'locked',
				title: 'Vacuum',
				status: 'Unlocks tomorrow',
			});
			await expect.element(page.getByText('Unlocks tomorrow')).toBeVisible();
		});
	});

	describe('editor variant', () => {
		it('renders number, title, hint and points chip', async () => {
			render(StageStep, {
				variant: 'editor',
				number: 2,
				title: 'Load the dishwasher',
				hint: 'Keep fragile items out.',
				points: 10,
			});
			await expect.element(page.getByText('Load the dishwasher')).toBeVisible();
			await expect
				.element(page.getByText('Keep fragile items out.'))
				.toBeVisible();
			await expect.element(page.getByText('10 pts')).toBeVisible();
			await expect.element(page.getByText('2', { exact: true })).toBeVisible();
		});

		it('omits the hint when not provided', async () => {
			render(StageStep, {
				variant: 'editor',
				number: 1,
				title: 'Clear counters',
				points: 5,
			});
			await expect.element(page.getByText('5 pts')).toBeVisible();
			await expect
				.element(page.getByRole('listitem'))
				.not.toHaveAttribute('data-state');
		});
	});
});
