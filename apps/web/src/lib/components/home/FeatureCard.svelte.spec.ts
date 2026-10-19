import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import FeatureCard from './FeatureCard.svelte';

const props = {
	icon: '/icon.svg',
	title: 'Shared rotations',
	description: 'Take turns on the jobs you share.',
	example: 'Wash the dishes · Feed the dog',
};

describe('FeatureCard.svelte', () => {
	it('renders the title as an h3 with description and example', async () => {
		render(FeatureCard, props);
		await expect
			.element(
				page.getByRole('heading', { level: 3, name: 'Shared rotations' }),
			)
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Take turns on the jobs you share.'))
			.toBeInTheDocument();
		await expect
			.element(page.getByText('Wash the dishes · Feed the dog'))
			.toBeInTheDocument();
		await expect.element(page.getByText('For example')).toBeInTheDocument();
	});
});
