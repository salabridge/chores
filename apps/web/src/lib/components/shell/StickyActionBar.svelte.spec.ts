import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import StickyActionBar from './StickyActionBar.svelte';

const raw = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('StickyActionBar.svelte', () => {
	it('renders the CTA and the optional summary', async () => {
		render(StickyActionBar, {
			children: raw('<button>Start</button>'),
			summary: raw('<span>Reward after all 3 stages · 15 pts</span>'),
		});
		await expect
			.element(page.getByRole('button', { name: 'Start' }))
			.toBeVisible();
		await expect
			.element(page.getByText('Reward after all 3 stages · 15 pts'))
			.toBeVisible();
	});

	it('omits the summary when not provided', async () => {
		render(StickyActionBar, { children: raw('<button>Start</button>') });
		await expect.element(page.getByText('Reward')).not.toBeInTheDocument();
	});
});
