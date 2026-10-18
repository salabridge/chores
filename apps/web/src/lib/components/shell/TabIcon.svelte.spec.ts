import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TabIcon from './TabIcon.svelte';

describe('TabIcon.svelte', () => {
	it('is decorative and sized by its prop', async () => {
		const { container } = render(TabIcon, { icon: 'gift', size: 20 });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
		expect(svg?.getAttribute('width')).toBe('20');
		expect(svg?.querySelector('rect')).not.toBeNull();
	});

	it('defaults to the tab bar size', async () => {
		const { container } = render(TabIcon, { icon: 'home' });
		expect(container.querySelector('svg')?.getAttribute('width')).toBe('22');
	});
});
