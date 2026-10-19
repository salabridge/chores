import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import HomeFeatures from './HomeFeatures.svelte';

describe('HomeFeatures.svelte', () => {
	it('has an h2 and three h3 feature titles', async () => {
		render(HomeFeatures);
		await expect
			.element(
				page.getByRole('heading', {
					level: 2,
					name: 'A simple loop for the whole household',
				}),
			)
			.toBeInTheDocument();
		const titles = page.getByRole('heading', { level: 3 });
		expect(titles.elements().map((e) => e.textContent?.trim())).toEqual([
			'Personal chores',
			'Shared rotations',
			'Points & rewards',
		]);
	});
});
