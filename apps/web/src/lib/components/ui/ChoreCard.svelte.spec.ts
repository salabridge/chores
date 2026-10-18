import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ChoreCard from './ChoreCard.svelte';

const base = { href: '/chores/1', title: 'Clean Your Room' };

describe('ChoreCard.svelte', () => {
	it('renders the whole card as a link to href', async () => {
		render(ChoreCard, base);
		const link = page.getByRole('link');
		await expect.element(link).toHaveAttribute('href', '/chores/1');
		await expect.element(link).toHaveTextContent('Clean Your Room');
	});

	it('renders subtitle, points and status badge', async () => {
		render(ChoreCard, {
			...base,
			subtitle: 'Stage 2 of 3 • Continue where you left off',
			points: 15,
			status: 'in-progress',
		});
		await expect
			.element(page.getByText('Stage 2 of 3 • Continue where you left off'))
			.toBeVisible();
		await expect.element(page.getByText('15 pts')).toBeVisible();
		await expect
			.element(page.getByText('In Progress'))
			.toHaveAttribute('data-tone', 'in-progress');
	});

	it('omits optional parts when not provided', async () => {
		const { container } = render(ChoreCard, base);
		expect(container.textContent).not.toContain('pts');
		expect(container.querySelector('[data-tone]')).toBeNull();
	});

	it('renders the icon snippet in the tile', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<i data-testid="chore-icon"></i>',
		}));
		const { container } = render(ChoreCard, { ...base, icon });
		expect(
			container.querySelector(
				'[data-slot="icon-tile"] [data-testid="chore-icon"]',
			),
		).not.toBeNull();
	});

	it('defaults to the personal variant with an orange tile', async () => {
		const { container } = render(ChoreCard, base);
		expect(container.querySelector('a')?.dataset.variant).toBe('personal');
		expect(
			container.querySelector('[data-slot="icon-tile"]')?.className,
		).toContain('bg-surface-accent-orange-subtle');
	});

	it('highlighted variant has a blue border and a filled arrow', async () => {
		const { container } = render(ChoreCard, {
			...base,
			variant: 'highlighted',
			status: 'my-turn',
		});
		expect(container.querySelector('a')?.className).toContain(
			'border-border-blue',
		);
		const arrow = container.querySelector('[data-slot="arrow"]');
		expect(arrow?.getAttribute('data-filled')).toBe('true');
		expect(arrow?.className).toContain('bg-accent-blue');
	});

	it('separates points from the badge with a dot', async () => {
		const { container } = render(ChoreCard, {
			...base,
			points: 10,
			status: 'todo',
		});
		expect(container.querySelector('.bg-border-muted')).not.toBeNull();
		expect(container.querySelector('[data-variant="inline"]')).toBeNull();
	});

	it('completed variant is muted with a green tile and a check', async () => {
		const { container } = render(ChoreCard, {
			...base,
			variant: 'completed',
			status: 'completed',
		});
		expect(page.getByText('Clean Your Room').element().className).toContain(
			'text-text-muted',
		);
		expect(
			container.querySelector('[data-slot="arrow"] path')?.getAttribute('d'),
		).toBe('M20 6 9 17l-5-5');
		expect(
			container.querySelector('[data-slot="icon-tile"]')?.className,
		).toContain('bg-surface-accent-green-subtle');
		await expect
			.element(page.getByText('Completed'))
			.toHaveAttribute('data-tone', 'completed');
	});

	it('hides decorative parts from assistive tech and merges class', async () => {
		const { container } = render(ChoreCard, { ...base, class: 'extra' });
		expect(
			container
				.querySelector('[data-slot="arrow"]')
				?.getAttribute('aria-hidden'),
		).toBe('true');
		expect(container.querySelector('a')?.className).toContain('extra');
	});
});
