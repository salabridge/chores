import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import RotationLoopVisual from './RotationLoopVisual.svelte';

const props = { doneLast: 'Mia', active: 'Leo', nextUp: 'Kai' };

describe('RotationLoopVisual.svelte', () => {
	it('labels the three positions', async () => {
		render(RotationLoopVisual, props);
		await expect.element(page.getByText('Done Last')).toBeVisible();
		await expect.element(page.getByText('Active Turn')).toBeVisible();
		await expect.element(page.getByText('Next Up')).toBeVisible();
	});

	it('renders three large avatars', async () => {
		const { container } = render(RotationLoopVisual, props);
		await expect.element(page.getByText('Active Turn')).toBeVisible();
		expect(container.querySelectorAll('[data-size="lg"]')).toHaveLength(3);
	});

	it('highlights only the active member', async () => {
		const { container } = render(RotationLoopVisual, props);
		await expect.element(page.getByText('Active Turn')).toBeVisible();
		const current = container.querySelectorAll('li[data-current="true"]');
		expect(current).toHaveLength(1);
		expect(current[0].getAttribute('aria-current')).toBe('step');
		expect(current[0].textContent).toContain('Leo');
		expect(
			current[0].querySelector('[data-size="lg"]')?.getAttribute('data-active'),
		).toBe('true');
		expect(
			container.querySelectorAll('[data-size="lg"][data-active="false"]'),
		).toHaveLength(2);
	});

	it('stays within a narrow container', async () => {
		const { container } = render(RotationLoopVisual, {
			doneLast: 'Bartholomew',
			active: 'Maximilian',
			nextUp: 'Wilhelmina',
			style: 'width: 220px',
		});
		await expect.element(page.getByText('Active Turn')).toBeVisible();
		const root = container.firstElementChild as HTMLElement;
		expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
	});

	it('merges a custom class', async () => {
		const { container } = render(RotationLoopVisual, {
			...props,
			class: 'extra',
		});
		expect(container.firstElementChild?.classList.contains('extra')).toBe(true);
	});
});
