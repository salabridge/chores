import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SummaryTile from './SummaryTile.svelte';

describe('SummaryTile.svelte', () => {
	it('renders label, value and caption', async () => {
		render(SummaryTile, {
			label: 'Personal',
			value: '2 chores',
			caption: 'due today',
		});
		await expect.element(page.getByText('Personal')).toBeVisible();
		await expect.element(page.getByText('2 chores')).toBeVisible();
		await expect.element(page.getByText('due today')).toBeVisible();
	});

	it('defaults to the orange tone', async () => {
		const { container } = render(SummaryTile, { label: 'A', value: 'B' });
		expect(
			container.querySelector('[data-tone]')?.getAttribute('data-tone'),
		).toBe('orange');
	});

	it('supports the blue tone', async () => {
		const { container } = render(SummaryTile, {
			label: 'C',
			value: 'D',
			tone: 'blue',
		});
		expect(
			container.querySelector('[data-tone]')?.getAttribute('data-tone'),
		).toBe('blue');
	});
});
