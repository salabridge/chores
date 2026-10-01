import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MemberChip from './MemberChip.svelte';

describe('MemberChip.svelte', () => {
	it('renders the member name', async () => {
		const { container } = render(MemberChip, { name: 'Mia' });
		await expect
			.element(container.firstElementChild as HTMLElement)
			.toHaveTextContent(/Mia$/);
	});

	it('shows the initial in a small avatar without a duplicate image role', async () => {
		const { container } = render(MemberChip, { name: 'Mia' });
		const avatar = container.querySelector('[data-size="sm"]');
		expect(avatar?.textContent?.trim()).toBe('M');
		expect(avatar?.getAttribute('role')).toBe('presentation');
	});

	it('merges a custom class', async () => {
		const { container } = render(MemberChip, { name: 'Mia', class: 'extra' });
		expect(container.firstElementChild?.classList.contains('extra')).toBe(true);
	});
});
