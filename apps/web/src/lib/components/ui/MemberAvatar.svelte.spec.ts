import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MemberAvatar from './MemberAvatar.svelte';

describe('MemberAvatar.svelte', () => {
	it('shows the uppercased initial and names the image after the member', async () => {
		render(MemberAvatar, { name: 'leo' });
		const avatar = page.getByRole('img', { name: 'leo' });
		await expect.element(avatar).toHaveTextContent('L');
	});

	it('defaults to md and supports each size', async () => {
		const md = render(MemberAvatar, { name: 'Mia' });
		await expect
			.element(page.getByRole('img'))
			.toHaveAttribute('data-size', 'md');
		md.unmount();
		for (const size of ['sm', 'lg'] as const) {
			const { unmount } = render(MemberAvatar, { name: 'Mia', size });
			await expect
				.element(page.getByRole('img'))
				.toHaveAttribute('data-size', size);
			unmount();
		}
	});

	it('exposes active state for lg avatars only', async () => {
		const active = render(MemberAvatar, { name: 'Mia', size: 'lg' });
		await expect
			.element(page.getByRole('img'))
			.toHaveAttribute('data-active', 'true');
		active.unmount();
		const inactive = render(MemberAvatar, {
			name: 'Mia',
			size: 'lg',
			active: false,
		});
		await expect
			.element(page.getByRole('img'))
			.toHaveAttribute('data-active', 'false');
		inactive.unmount();
		const small = render(MemberAvatar, {
			name: 'Mia',
			size: 'sm',
			active: false,
		});
		expect(small.container.firstElementChild?.hasAttribute('data-active')).toBe(
			false,
		);
	});
});
