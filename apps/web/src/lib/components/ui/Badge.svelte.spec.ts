import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Badge, { type BadgeTone, badgeTones } from './Badge.svelte';

describe('Badge.svelte', () => {
	it.each(Object.entries(badgeTones) as [BadgeTone, { label: string }][])(
		'renders the default label for %s',
		async (tone, { label }) => {
			render(Badge, { tone });
			const badge = page.getByText(label);
			await expect.element(badge).toBeVisible();
			await expect.element(badge).toHaveAttribute('data-tone', tone);
		},
	);

	it('lets children override the label', async () => {
		const children = createRawSnippet(() => ({ render: () => '<b>Mine</b>' }));
		render(Badge, { tone: 'todo', children });
		await expect.element(page.getByText('Mine')).toBeVisible();
	});

	it('renders a colour dot only for section tags that have one', async () => {
		const personal = render(Badge, { tone: 'personal' });
		expect(
			personal.container.querySelectorAll('[aria-hidden="true"]'),
		).toHaveLength(1);
		personal.unmount();
		const todo = render(Badge, { tone: 'todo' });
		expect(
			todo.container.querySelectorAll('[aria-hidden="true"]'),
		).toHaveLength(0);
	});

	it('merges a custom class', async () => {
		render(Badge, { tone: 'todo', class: 'extra' });
		await expect.element(page.getByText('Todo')).toHaveClass('extra');
	});
});
