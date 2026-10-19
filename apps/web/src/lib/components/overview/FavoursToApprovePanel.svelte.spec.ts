import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { NOW, panelFavours } from '../favours/fixtures.ts';
import FavoursToApprovePanel from './FavoursToApprovePanel.svelte';

const actions = () => ({
	approve: vi.fn(async (_id: string) => {}),
	decline: vi.fn(async (_id: string) => {}),
});

describe('FavoursToApprovePanel.svelte', () => {
	it('lists who did it, whose chore it was and when, escalated first', async () => {
		render(FavoursToApprovePanel, {
			favours: panelFavours,
			actions: actions(),
			now: NOW,
		});
		await expect
			.element(page.getByRole('heading', { name: 'Favours to approve' }))
			.toBeVisible();
		await expect.element(page.getByText('3 waiting')).toBeVisible();
		const rows = page.getByRole('listitem');
		await expect
			.element(rows.first())
			.toHaveTextContent('Mia did Feed the Dog');
		await expect.element(rows.first()).toHaveTextContent('Asked a parent');
		await expect
			.element(rows.first())
			.toHaveTextContent("Leo's chore · 5 pts · 3 hr ago");
		expect(page.getByText('Asked a parent').elements()).toHaveLength(1);
	});

	it('approves and declines the row it was pressed on', async () => {
		const a = actions();
		render(FavoursToApprovePanel, {
			favours: panelFavours,
			actions: a,
			now: NOW,
		});
		await page.getByRole('button', { name: 'Approve Mow the Lawn' }).click();
		expect(a.approve).toHaveBeenCalledWith('c7');
		await page.getByRole('button', { name: 'Decline Take Out Trash' }).click();
		expect(a.decline).toHaveBeenCalledWith('c1');
	});

	it('lets a parent decide a favour that was not escalated', async () => {
		render(FavoursToApprovePanel, {
			favours: panelFavours.slice(2),
			actions: actions(),
			now: NOW,
		});
		await expect
			.element(page.getByRole('button', { name: 'Approve Take Out Trash' }))
			.toBeEnabled();
	});

	it('shows why a decision failed', async () => {
		const a = actions();
		a.approve.mockRejectedValueOnce(
			new Error('Someone already decided this favour.'),
		);
		render(FavoursToApprovePanel, {
			favours: panelFavours,
			actions: a,
			now: NOW,
		});
		await page.getByRole('button', { name: 'Approve Mow the Lawn' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Someone already decided this favour.');
	});

	it('renders nothing without favours', async () => {
		render(FavoursToApprovePanel, { favours: [], actions: actions() });
		expect(page.getByTestId('favours-panel').elements()).toHaveLength(0);
	});
});
