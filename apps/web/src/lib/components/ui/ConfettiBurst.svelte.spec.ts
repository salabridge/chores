import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { confettiPieces } from '#lib/chore-completion.js';
import ConfettiBurst from './ConfettiBurst.svelte';

/** Fakes the user's motion setting; the component asks for reduce. */
function prefersReducedMotion(reduce: boolean) {
	vi.stubGlobal(
		'matchMedia',
		(query: string) =>
			({
				matches: query.includes('prefers-reduced-motion: reduce') && reduce,
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
			}) as unknown as MediaQueryList,
	);
}

afterEach(() => vi.unstubAllGlobals());

const root = (container: HTMLElement) =>
	container.querySelector('[data-motion]') as HTMLElement;

describe('ConfettiBurst.svelte', () => {
	it('renders every piece, hidden from assistive tech', () => {
		prefersReducedMotion(false);
		const { container } = render(ConfettiBurst);
		expect(container.querySelectorAll('[data-piece]')).toHaveLength(
			confettiPieces.length,
		);
		expect(root(container).getAttribute('aria-hidden')).toBe('true');
	});

	it('animates when the system allows motion', () => {
		prefersReducedMotion(false);
		const { container } = render(ConfettiBurst);
		expect(root(container).dataset.motion).toBe('full');
	});

	it('keeps the pieces still when the system asks for reduced motion', () => {
		prefersReducedMotion(true);
		const { container } = render(ConfettiBurst);
		const el = root(container);
		expect(el.dataset.motion).toBe('reduced');
		// Same pieces, no animation running on them.
		for (const piece of el.querySelectorAll('[data-piece]')) {
			expect(getComputedStyle(piece).animationName).toBe('none');
		}
	});
});
