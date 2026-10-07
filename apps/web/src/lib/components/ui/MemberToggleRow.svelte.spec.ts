import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MemberToggleRow from './MemberToggleRow.svelte';

const avatar = createRawSnippet(() => ({
	render: () => '<span data-testid="avatar">M</span>',
}));

describe('MemberToggleRow.svelte', () => {
	it('shows the eligible status when on', async () => {
		render(MemberToggleRow, { name: 'Mom', checked: true, avatar });
		await expect.element(page.getByText('Mom')).toBeVisible();
		await expect
			.element(page.getByText('Eligible rotation member'))
			.toHaveClass('text-text-green');
		await expect.element(page.getByTestId('avatar')).toBeVisible();
		await expect
			.element(page.getByRole('switch', { name: 'Mom' }))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('shows the exclusion reason and dims when off', async () => {
		render(MemberToggleRow, {
			name: 'Mia',
			checked: false,
			reason: 'Too young for hot-water handling',
		});
		await expect
			.element(page.getByText('Too young for hot-water handling'))
			.toHaveClass('text-text-secondary');
		const row = page
			.getByText('Mia')
			.element()
			.closest<HTMLElement>('[data-checked]');
		if (!row) throw new Error('Expected Mia to be inside the toggle row');
		await expect.element(row).toHaveClass('opacity-60');
	});

	it('swaps status text when toggled', async () => {
		render(MemberToggleRow, {
			name: 'Mia',
			checked: false,
			reason: 'Too young',
		});
		await page.getByRole('switch', { name: 'Mia' }).click();
		await expect
			.element(page.getByText('Eligible rotation member'))
			.toBeVisible();
	});

	it('renders extra actions before the toggle', async () => {
		const actions = createRawSnippet(() => ({
			render: () => '<button type="button">Move</button>',
		}));
		render(MemberToggleRow, { name: 'Leo', actions });
		await expect
			.element(page.getByRole('button', { name: 'Move' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('switch', { name: 'Leo' }))
			.toBeVisible();
	});

	it('works without an avatar', async () => {
		render(MemberToggleRow, { name: 'Leo' });
		await expect
			.element(page.getByRole('switch', { name: 'Leo' }))
			.toBeVisible();
	});
});
