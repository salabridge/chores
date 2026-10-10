import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { workloadFixture } from './fixtures.ts';
import MemberWorkloadPanel from './MemberWorkloadPanel.svelte';

describe('MemberWorkloadPanel.svelte', () => {
	it('shows each member with counts, bar and summary, plus the Balanced badge', async () => {
		render(MemberWorkloadPanel, { workload: workloadFixture });
		await expect.element(page.getByText('Balanced')).toBeVisible();
		await expect.element(page.getByText('Leo')).toBeVisible();
		await expect.element(page.getByText('2 active / 0 done')).toBeVisible();
		await expect.element(page.getByText('0 active / 1 done')).toBeVisible();
		await expect
			.element(page.getByText('Nothing assigned today.'))
			.toBeVisible();
		expect(page.getByRole('progressbar').elements()).toHaveLength(4);
	});

	it('flags an unbalanced household', async () => {
		render(MemberWorkloadPanel, {
			workload: { ...workloadFixture, balance: 'unbalanced' },
		});
		await expect.element(page.getByText('Unbalanced')).toBeVisible();
	});

	it('handles a household with no members', async () => {
		render(MemberWorkloadPanel, {
			workload: { balance: 'balanced', members: [] },
		});
		await expect
			.element(page.getByText('No household members yet.'))
			.toBeVisible();
	});
});
