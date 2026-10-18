import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PriorityCallout from './PriorityCallout.svelte';

describe('PriorityCallout.svelte', () => {
	it('renders title and body', async () => {
		const children = createRawSnippet(() => ({
			render: () => '<span>Complete these first.</span>',
		}));
		render(PriorityCallout, { title: 'Priority loop first', children });
		await expect.element(page.getByRole('note')).toBeVisible();
		await expect.element(page.getByText('Priority loop first')).toBeVisible();
		await expect.element(page.getByText('Complete these first.')).toBeVisible();
	});

	it('becomes one link with a call to action when given href', async () => {
		render(PriorityCallout, {
			title: 'Priority loop first',
			href: '/chores/toilet',
		});
		const link = page.getByRole('link');
		await expect.element(link).toHaveAttribute('href', '/chores/toilet');
		await expect.element(link).toHaveTextContent('Priority loop first');
		await expect.element(page.getByRole('note')).not.toBeInTheDocument();
		expect(
			link.element().querySelector('[data-slot="action"]')?.textContent,
		).toContain('Open loop');
	});

	it('shows the arrow at every width, the label only from lg', async () => {
		const { container } = render(PriorityCallout, {
			title: 'Priority loop first',
			href: '/chores/toilet',
		});
		const action = container.querySelector('[data-slot="action"]');
		expect(action?.className).not.toContain('hidden');
		expect(action?.querySelector('svg')).not.toBeNull();
		expect(action?.querySelector('span')?.className).toContain('lg:inline');
	});

	it('has no call to action without href', async () => {
		const { container } = render(PriorityCallout, { title: 'T' });
		expect(container.querySelector('a')).toBeNull();
		expect(container.querySelector('[data-slot="action"]')).toBeNull();
	});

	it('renders an icon override in the tile', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<span data-testid="custom">x</span>',
		}));
		render(PriorityCallout, { title: 'T', icon });
		await expect.element(page.getByTestId('custom')).toBeVisible();
	});
});
