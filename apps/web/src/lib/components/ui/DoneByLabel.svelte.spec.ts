import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DoneByLabel from './DoneByLabel.svelte';

describe('DoneByLabel.svelte', () => {
	it('says who did it', async () => {
		render(DoneByLabel, { name: 'Mia' });
		await expect.element(page.getByText('Done by Mia')).toBeVisible();
	});

	it('hides the avatar from assistive tech so the name is read once', async () => {
		render(DoneByLabel, { name: 'Mia' });
		expect(page.getByRole('img').elements()).toHaveLength(0);
	});
});
