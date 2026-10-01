import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import StatCard from './StatCard.svelte';

describe('StatCard.svelte', () => {
	it('renders label, value, caption and badge', async () => {
		render(StatCard, {
			label: 'Total Loop Chores',
			value: '12 Chores',
			caption: '7 shared loops.',
			badge: createRawSnippet(() => ({
				render: () => '<span>12 active</span>',
			})),
		});
		await expect.element(page.getByText('Total Loop Chores')).toBeVisible();
		await expect.element(page.getByText('12 Chores')).toBeVisible();
		await expect.element(page.getByText('7 shared loops.')).toBeVisible();
		await expect.element(page.getByText('12 active')).toBeVisible();
	});

	it('omits optional parts', async () => {
		render(StatCard, { label: 'L', value: 'V' });
		await expect.element(page.getByText('V')).toBeVisible();
		expect(page.getByText('12 active').elements()).toHaveLength(0);
	});
});
