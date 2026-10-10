import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ManageChoresPanel from './ManageChoresPanel.svelte';

describe('ManageChoresPanel.svelte', () => {
	it('links to the three management screens', async () => {
		render(ManageChoresPanel);
		const link = (name: string) => page.getByRole('link', { name });
		await expect
			.element(link('Create & Assign'))
			.toHaveAttribute('href', '/chores/new');
		await expect
			.element(link('Rotation Builder'))
			.toHaveAttribute('href', '/rotations');
		await expect
			.element(link('Overview Review'))
			.toHaveAttribute('href', '/overview');
		expect(page.getByRole('link').elements()).toHaveLength(3);
	});
});
