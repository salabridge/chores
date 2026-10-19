import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { leoFavours, miaFavours } from './fixtures.ts';
import TodayFavours from './TodayFavours.svelte';

const actions = () => ({
	approve: vi.fn(async (_id: string) => {}),
	decline: vi.fn(async (_id: string) => {}),
	askParent: vi.fn(async (_id: string) => {}),
});

describe('TodayFavours.svelte', () => {
	it("shows the cards that need the member's OK", async () => {
		render(TodayFavours, { favours: leoFavours, actions: actions() });
		await expect.element(page.getByTestId('favour-approval')).toBeVisible();
		expect(page.getByTestId('my-favours').elements()).toHaveLength(0);
	});

	it("lists the member's own favours under a heading", async () => {
		render(TodayFavours, { favours: miaFavours, actions: actions() });
		await expect
			.element(page.getByRole('heading', { name: 'Your favours' }))
			.toBeVisible();
		expect(page.getByTestId('my-favour').elements()).toHaveLength(6);
		expect(page.getByTestId('favours-to-approve').elements()).toHaveLength(0);
	});

	it('renders nothing without favours', async () => {
		const view = render(TodayFavours, {
			favours: { toApprove: [], mine: [] },
			actions: actions(),
		});
		expect(view.container.textContent?.trim()).toBe('');
	});
});
