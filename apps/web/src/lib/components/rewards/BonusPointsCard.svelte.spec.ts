import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { GiftItem } from '#lib/gift.js';
import BonusPointsCard from './BonusPointsCard.svelte';

const gifts: GiftItem[] = [
	{
		id: 'g1',
		points: 20,
		reason: 'Helped Grandma with groceries',
		fromName: 'Mom',
		createdAt: '2026-10-14T12:00:00.000Z',
	},
	{
		id: 'g2',
		points: 5,
		reason: 'Good report card',
		fromName: null,
		createdAt: '2026-10-12T12:00:00.000Z',
	},
];

describe('BonusPointsCard.svelte', () => {
	it('shows each gift with its points, reason and giver', async () => {
		render(BonusPointsCard, { gifts });
		await expect
			.element(page.getByText('+20 · Helped Grandma with groceries · from Mom'))
			.toBeVisible();
	});

	it('leaves out the giver when they have since left', async () => {
		render(BonusPointsCard, { gifts });
		await expect
			.element(page.getByText('+5 · Good report card', { exact: true }))
			.toBeVisible();
	});

	it('lists one item per gift', async () => {
		render(BonusPointsCard, { gifts });
		expect(page.getByRole('listitem').elements()).toHaveLength(2);
	});

	it('says gifts do not count toward the weekly goal', async () => {
		render(BonusPointsCard, { gifts });
		await expect.element(page.getByText(/not your weekly goal/)).toBeVisible();
	});
});
