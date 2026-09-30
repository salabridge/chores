import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PrimaryButton from './PrimaryButton.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>Go</span>' }));

describe('PrimaryButton.svelte', () => {
	it('renders a type="button" button by default', async () => {
		render(PrimaryButton, { children });
		const button = page.getByRole('button', { name: 'Go' });
		await expect.element(button).toHaveAttribute('type', 'button');
		await expect.element(button).toBeEnabled();
	});

	it('honours an explicit type', async () => {
		render(PrimaryButton, { children, type: 'submit' });
		await expect
			.element(page.getByRole('button'))
			.toHaveAttribute('type', 'submit');
	});

	it('disables and sets aria-busy when pending', async () => {
		render(PrimaryButton, { children, pending: true });
		const button = page.getByRole('button');
		await expect.element(button).toBeDisabled();
		await expect.element(button).toHaveAttribute('aria-busy', 'true');
	});

	it('renders an anchor when href is passed', async () => {
		render(PrimaryButton, { children, href: '/login' });
		await expect
			.element(page.getByRole('link', { name: 'Go' }))
			.toHaveAttribute('href', '/login');
	});

	it('marks a pending anchor as busy and disabled', async () => {
		render(PrimaryButton, { children, href: '/login', pending: true });
		const link = page.getByRole('link');
		await expect.element(link).toHaveAttribute('aria-busy', 'true');
		await expect.element(link).toHaveAttribute('aria-disabled', 'true');
	});
});
