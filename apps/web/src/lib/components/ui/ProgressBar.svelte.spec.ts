import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ProgressBar from './ProgressBar.svelte';

describe('ProgressBar.svelte', () => {
	it('exposes progressbar semantics', async () => {
		render(ProgressBar, { value: 3, max: 5, label: 'Weekly goal' });
		const bar = page.getByRole('progressbar', { name: 'Weekly goal' });
		await expect.element(bar).toHaveAttribute('aria-valuenow', '3');
		await expect.element(bar).toHaveAttribute('aria-valuemin', '0');
		await expect.element(bar).toHaveAttribute('aria-valuemax', '5');
	});

	it('sizes the fill proportionally', () => {
		const { container } = render(ProgressBar, { value: 1, max: 4 });
		const fill = container.querySelector<HTMLElement>('[data-fill]');
		expect(fill?.style.width).toBe('25%');
	});

	it('clamps out-of-range values', async () => {
		render(ProgressBar, { value: 12, max: 10 });
		await expect
			.element(page.getByRole('progressbar'))
			.toHaveAttribute('aria-valuenow', '10');
	});

	it('renders the label row', async () => {
		render(ProgressBar, {
			value: 2,
			max: 5,
			label: 'Streak',
			valueLabel: '2 / 5',
		});
		await expect.element(page.getByText('Streak')).toBeVisible();
		await expect.element(page.getByText('2 / 5')).toBeVisible();
	});

	it.each([
		['green', 'bg-accent-green'],
		['orange', 'bg-accent-orange'],
		['blue', 'bg-accent-blue'],
	] as const)('applies the %s variant', (variant, cls) => {
		const { container } = render(ProgressBar, { value: 1, variant });
		expect(container.querySelector('[data-fill]')?.className).toContain(cls);
	});

	it('uses a thinner track for the thin size', async () => {
		render(ProgressBar, { value: 1, size: 'thin' });
		await expect.element(page.getByRole('progressbar')).toHaveClass('h-[6px]');
	});
});
