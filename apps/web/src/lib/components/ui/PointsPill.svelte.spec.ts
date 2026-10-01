import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PointsPill from './PointsPill.svelte';

describe('PointsPill.svelte', () => {
	it('renders points with a star icon by default', async () => {
		const { container } = render(PointsPill, { points: 15 });
		await expect.element(page.getByText('15 pts')).toBeVisible();
		expect(container.querySelector('[data-icon="star"]')).not.toBeNull();
		expect(container.querySelector('[data-icon="ribbon"]')).toBeNull();
	});

	it('renders the header variant with a ribbon icon', async () => {
		const { container } = render(PointsPill, {
			points: 140,
			variant: 'header',
		});
		await expect.element(page.getByText('140 pts')).toBeVisible();
		expect(container.querySelector('[data-icon="ribbon"]')).not.toBeNull();
		expect(container.querySelector('[data-icon="star"]')).toBeNull();
	});

	it('hides the icon from assistive tech', async () => {
		const { container } = render(PointsPill, { points: 5 });
		expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
			'true',
		);
	});
});
