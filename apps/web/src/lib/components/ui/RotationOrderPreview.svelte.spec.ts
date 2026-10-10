import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import RotationOrderPreview from './RotationOrderPreview.svelte';

const members = [{ name: 'Leo' }, { name: 'Mia' }];

describe('RotationOrderPreview.svelte', () => {
	it('renders a chip per member followed by the loop reset tag', async () => {
		const { container } = render(RotationOrderPreview, { members });
		await expect.element(page.getByText('Leo')).toBeVisible();
		await expect.element(page.getByText('Mia')).toBeVisible();
		await expect.element(page.getByText('Loop Reset')).toBeVisible();
		const items = container.querySelectorAll('li');
		expect(items).toHaveLength(3);
		expect(items[2].hasAttribute('data-reset')).toBe(true);
	});

	it('puts the reset tag where the loop wraps', async () => {
		const { container } = render(RotationOrderPreview, {
			members: [{ name: 'Leo' }, { name: 'Mia' }, { name: 'Mom' }],
			resetAt: 1,
			showSummary: true,
		});
		await expect
			.element(page.getByText('Leo → loop reset → Mia → Mom'))
			.toBeVisible();
		const items = [...container.querySelectorAll('li')];
		expect(items).toHaveLength(4);
		expect(items[1].hasAttribute('data-reset')).toBe(true);
	});

	it('puts an arrow before every item except the first', async () => {
		const { container } = render(RotationOrderPreview, { members });
		await expect.element(page.getByText('Leo')).toBeVisible();
		expect(container.querySelectorAll('[data-arrow]')).toHaveLength(2);
		expect(container.querySelector('li:first-child [data-arrow]')).toBeNull();
	});

	it('hides the summary chip by default', async () => {
		const { container } = render(RotationOrderPreview, { members });
		await expect.element(page.getByText('Leo')).toBeVisible();
		expect(container.querySelector('[data-summary]')).toBeNull();
	});

	it('shows the summary chip when requested', async () => {
		render(RotationOrderPreview, { members, showSummary: true });
		await expect
			.element(page.getByText('Leo → Mia → loop reset'))
			.toBeVisible();
	});

	it('wraps onto multiple lines in a narrow container', async () => {
		const { container } = render(RotationOrderPreview, {
			members: [
				{ name: 'Mom' },
				{ name: 'Dad' },
				{ name: 'Leo' },
				{ name: 'Mia' },
			],
			style: 'width: 200px',
		});
		await expect.element(page.getByText('Mom')).toBeVisible();
		const root = container.firstElementChild as HTMLElement;
		expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
		const tops = new Set(
			[...container.querySelectorAll('li')].map((li) =>
				Math.round(li.getBoundingClientRect().top),
			),
		);
		expect(tops.size).toBeGreaterThan(1);
	});

	it('merges a custom class', async () => {
		const { container } = render(RotationOrderPreview, {
			members,
			class: 'extra',
		});
		expect(container.firstElementChild?.classList.contains('extra')).toBe(true);
	});
});
