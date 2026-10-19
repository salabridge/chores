import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AvatarColorPicker from './AvatarColorPicker.svelte';

const hidden = (container: HTMLElement) =>
	container.querySelector<HTMLInputElement>('input[type="hidden"]');

describe('AvatarColorPicker.svelte', () => {
	it('offers every preset plus Custom', async () => {
		render(AvatarColorPicker, { name: 'avatarColor', value: 'blue' });
		for (const label of [
			'Orange',
			'Blue',
			'Green',
			'Amber',
			'Red',
			'Purple',
			'Pink',
			'Teal',
			'Slate',
			'Custom',
		]) {
			await expect
				.element(page.getByText(label, { exact: true }))
				.toBeVisible();
		}
	});

	it('submits the chosen preset key', async () => {
		const { container } = render(AvatarColorPicker, {
			name: 'avatarColor',
			value: 'blue',
		});
		expect(hidden(container)?.value).toBe('blue');
		await page.getByRole('radio', { name: 'Red' }).click({ force: true });
		expect(hidden(container)?.value).toBe('red');
	});

	it('selects Custom for a hex value and submits it', async () => {
		const { container } = render(AvatarColorPicker, {
			name: 'avatarColor',
			value: '#a1b2c3',
		});
		await expect
			.element(page.getByRole('radio', { name: 'Custom' }))
			.toBeChecked();
		expect(hidden(container)?.value).toBe('#a1b2c3');
		const color = container.querySelector<HTMLInputElement>(
			'input[type="color"]',
		);
		expect(color?.value).toBe('#a1b2c3');
	});
});
