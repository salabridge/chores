import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FavourBanner from './FavourBanner.svelte';

describe('FavourBanner.svelte', () => {
	it('names the owner and says the member gets the points', async () => {
		render(FavourBanner, { ownerName: 'Leo' });
		await expect.element(page.getByText("This is Leo's chore.")).toBeVisible();
		await expect
			.element(page.getByText("You'll get the points."))
			.toBeVisible();
	});

	it('points a parent at the select instead', async () => {
		render(FavourBanner, { ownerName: 'Leo', recording: true });
		await expect
			.element(page.getByText('Choose who did it below. They get the points.'))
			.toBeVisible();
		expect(page.getByText("You'll get the points.").elements()).toHaveLength(0);
	});
});
