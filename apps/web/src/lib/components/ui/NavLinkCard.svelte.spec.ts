import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import NavLinkCard from './NavLinkCard.svelte';

describe('NavLinkCard.svelte', () => {
	it('renders a link with title and description', async () => {
		render(NavLinkCard, {
			href: '/create',
			title: 'Create & Assign',
			description: 'Add a new chore.',
		});
		const link = page.getByRole('link', { name: /Create & Assign/ });
		await expect.element(link).toHaveAttribute('href', '/create');
		await expect.element(page.getByText('Add a new chore.')).toBeVisible();
	});

	it.each(['orange', 'blue', 'neutral'] as const)(
		'applies the %s tone',
		async (tone) => {
			render(NavLinkCard, { href: '/x', title: 'T', tone });
			await expect
				.element(page.getByRole('link'))
				.toHaveAttribute('data-tone', tone);
		},
	);

	it('renders the icon snippet', async () => {
		const { container } = render(NavLinkCard, {
			href: '/x',
			title: 'T',
			icon: createRawSnippet(() => ({
				render: () => '<i data-testid="ico"></i>',
			})),
		});
		expect(container.querySelector('[data-testid="ico"]')).not.toBeNull();
	});
});
