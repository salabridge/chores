import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SegmentedStageProgress from './SegmentedStageProgress.svelte';

const statuses = (container: Element) =>
	[...container.querySelectorAll<HTMLElement>('[data-segment]')].map(
		(el) => el.dataset.segment,
	);

describe('SegmentedStageProgress.svelte', () => {
	it('marks done, current and pending segments', () => {
		const { container } = render(SegmentedStageProgress, {
			title: 'Room Clean Progress',
			total: 3,
			done: 1,
		});
		expect(statuses(container)).toEqual(['done', 'current', 'pending']);
	});

	it('shows the done pill and description', async () => {
		render(SegmentedStageProgress, {
			title: 'Room Clean Progress',
			description: 'Stage 2 of 3 is active right now',
			total: 3,
			done: 1,
		});
		await expect.element(page.getByText('1 / 3 done')).toBeVisible();
		await expect
			.element(page.getByText('Stage 2 of 3 is active right now'))
			.toBeVisible();
	});

	it('exposes progressbar semantics', async () => {
		render(SegmentedStageProgress, { title: 'Room', total: 4, done: 2 });
		const bar = page.getByRole('progressbar', { name: 'Room' });
		await expect.element(bar).toHaveAttribute('aria-valuenow', '2');
		await expect.element(bar).toHaveAttribute('aria-valuemax', '4');
	});

	it('has no current segment when everything is done', async () => {
		const { container } = render(SegmentedStageProgress, {
			title: 'Room',
			total: 2,
			done: 5,
		});
		expect(statuses(container)).toEqual(['done', 'done']);
		await expect.element(page.getByText('2 / 2 done')).toBeVisible();
	});
});
