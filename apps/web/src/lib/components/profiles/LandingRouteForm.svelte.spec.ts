import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

// The real remote file imports server code; use the Storybook stand-in.
vi.mock('#lib/landing.remote.js', async () => {
	return await import('../../../../.storybook/mocks/landing-remote.ts');
});

import LandingRouteForm from './LandingRouteForm.svelte';

describe('LandingRouteForm.svelte', () => {
	it('offers Today and Parent dashboard', async () => {
		render(LandingRouteForm);
		await expect
			.element(page.getByRole('radio', { name: 'Today' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('radio', { name: 'Parent dashboard' }))
			.toBeInTheDocument();
	});

	it('selects the route in effect', async () => {
		render(LandingRouteForm, { landingRoute: 'overview' });
		await expect
			.element(page.getByRole('radio', { name: 'Parent dashboard' }))
			.toBeChecked();
		await expect
			.element(page.getByRole('radio', { name: 'Today' }))
			.not.toBeChecked();
	});

	it('submits the landingRoute field with the chosen value', async () => {
		const { container } = render(LandingRouteForm, { landingRoute: 'today' });
		await page.getByRole('radio', { name: 'Parent dashboard' }).click();
		const form = container.querySelector('form');
		expect(form).not.toBeNull();
		const data = new FormData(form as HTMLFormElement);
		expect(data.get('landingRoute')).toBe('overview');
	});
});
