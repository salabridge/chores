import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SecondaryButton from './SecondaryButton.svelte';

const children = createRawSnippet(() => ({
	render: () => '<span>Cancel</span>',
}));

describe('SecondaryButton.svelte', () => {
	it('renders a type="button" outline button by default', async () => {
		render(SecondaryButton, { children });
		const button = page.getByRole('button', { name: 'Cancel' });
		await expect.element(button).toHaveAttribute('type', 'button');
		await expect.element(button).toBeEnabled();
		await expect.element(button).toHaveClass('border-border-subtle');
	});

	it('honours an explicit type', async () => {
		render(SecondaryButton, { children, type: 'submit' });
		await expect
			.element(page.getByRole('button'))
			.toHaveAttribute('type', 'submit');
	});

	it('disables and sets aria-busy when pending', async () => {
		render(SecondaryButton, { children, pending: true });
		const button = page.getByRole('button');
		await expect.element(button).toBeDisabled();
		await expect.element(button).toHaveAttribute('aria-busy', 'true');
	});

	it('renders an anchor when href is passed', async () => {
		render(SecondaryButton, { children, href: '/loops' });
		await expect
			.element(page.getByRole('link', { name: 'Cancel' }))
			.toHaveAttribute('href', '/loops');
	});

	it('marks a pending anchor as busy and disabled', async () => {
		render(SecondaryButton, { children, href: '/loops', pending: true });
		const link = page.getByRole('link');
		await expect.element(link).toHaveAttribute('aria-busy', 'true');
		await expect.element(link).toHaveAttribute('aria-disabled', 'true');
	});

	it('names an icon-only button via aria-label', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<svg aria-hidden="true" width="16" height="16"></svg>',
		}));
		render(SecondaryButton, {
			children: icon,
			variant: 'icon',
			'aria-label': 'Refresh',
		});
		await expect
			.element(page.getByRole('button', { name: 'Refresh' }))
			.toHaveClass('size-[36px]');
	});

	it('tints small action buttons by tone', async () => {
		render(SecondaryButton, { children, variant: 'tinted', tone: 'green' });
		await expect
			.element(page.getByRole('button'))
			.toHaveClass('bg-surface-accent-green-subtle');
	});
});
