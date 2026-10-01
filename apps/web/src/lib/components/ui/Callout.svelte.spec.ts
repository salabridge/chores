import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Callout from './Callout.svelte';

const children = createRawSnippet(() => ({
	render: () => '<span>Body text</span>',
}));

describe('Callout.svelte', () => {
	it('renders title and body', async () => {
		render(Callout, { title: 'What happens next', children });
		await expect.element(page.getByRole('note')).toBeVisible();
		await expect.element(page.getByText('What happens next')).toBeVisible();
		await expect.element(page.getByText('Body text')).toBeVisible();
	});

	it('defaults to the info tone', async () => {
		render(Callout, { title: 'T', children });
		await expect
			.element(page.getByRole('note'))
			.toHaveAttribute('data-tone', 'info');
	});

	it.each(['info', 'success', 'warning', 'action'] as const)(
		'applies the %s tone',
		async (tone) => {
			render(Callout, { tone, title: 'T', children });
			await expect
				.element(page.getByRole('note'))
				.toHaveAttribute('data-tone', tone);
		},
	);

	it('omits the heading when no title is given', async () => {
		render(Callout, { children });
		await expect.element(page.getByText('Body text')).toBeVisible();
		expect(page.getByRole('note').element().querySelector('svg')).toBeNull();
	});

	it('uses an icon override instead of the default icon', async () => {
		const icon = createRawSnippet(() => ({
			render: () => '<span data-testid="custom-icon">!</span>',
		}));
		render(Callout, { title: 'T', icon });
		await expect.element(page.getByTestId('custom-icon')).toBeVisible();
		expect(page.getByRole('note').element().querySelector('svg')).toBeNull();
	});

	it('merges a custom class', async () => {
		render(Callout, { title: 'T', class: 'mt-4' });
		await expect.element(page.getByRole('note')).toHaveClass('mt-4');
	});
});
