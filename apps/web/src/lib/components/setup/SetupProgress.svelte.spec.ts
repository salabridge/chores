import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SetupProgress from './SetupProgress.svelte';

describe('SetupProgress.svelte', () => {
	it('names the current step and its position', async () => {
		render(SetupProgress, { current: 'kids' });
		await expect.element(page.getByText('Step 3 of 5: Kids')).toBeVisible();
	});

	it('marks only the current step with aria-current', async () => {
		const { container } = render(SetupProgress, { current: 'pin' });
		const current = container.querySelectorAll('[aria-current="step"]');
		expect(current).toHaveLength(1);
		expect(current[0]?.textContent).toContain('Parent PIN');
	});

	it('lists all five steps', async () => {
		const { container } = render(SetupProgress, { current: 'household' });
		expect(container.querySelectorAll('li')).toHaveLength(5);
	});
});
