import { describe, expect, it } from 'vitest';
import {
	celebrationHeading,
	completionHref,
	confettiPieces,
	goalLeftText,
	goalReachedText,
	pointsAwardedText,
	summaryLine,
	summaryTags,
	totalText,
} from './chore-completion.ts';
import {
	roomCompletion,
	toiletCompletion,
} from './components/chores/fixtures.ts';

describe('completionHref', () => {
	it('puts the completion in the URL so the screen reads it from the server', () => {
		expect(completionHref('c1', 'k1')).toBe('/chores/c1/done?completion=k1');
		expect(completionHref('a b', 'x&y')).toBe(
			'/chores/a%20b/done?completion=x%26y',
		);
	});
});

describe('celebration copy', () => {
	it('words the heading, points and total', () => {
		expect(celebrationHeading('Leo')).toBe('Nice work, Leo!');
		expect(pointsAwardedText(20)).toBe('+20 pts');
		expect(totalText(160)).toBe('Your total is now 160 pts.');
	});

	it('names the rotation hand-off, or nothing for a personal chore', () => {
		expect(summaryLine(toiletCompletion)).toBe(
			'Clean Bathroom Toilet is complete, and the rotation has moved to Mia.',
		);
		expect(summaryLine(roomCompletion)).toBe('Clean Your Room is complete.');
		expect(
			summaryLine({
				...toiletCompletion,
				rotation: { nextName: 'Leo', nextIsYou: true },
			}),
		).toContain('the next turn is yours too');
		expect(
			summaryLine({
				...toiletCompletion,
				rotation: { nextName: null, nextIsYou: false },
			}),
		).toBe('Clean Bathroom Toilet is complete.');
	});

	it('tags a rotation chore and leaves a personal one bare', () => {
		expect(summaryTags(toiletCompletion)).toEqual([
			{ tone: 'shared', label: 'Shared rotation' },
			{ tone: 'next', label: 'Next up: Mia' },
		]);
		expect(summaryTags(roomCompletion)).toEqual([]);
		expect(
			summaryTags({ rotation: { nextName: null, nextIsYou: false } }),
		).toEqual([{ tone: 'shared', label: 'Shared rotation' }]);
	});

	it('words the weekly goal', () => {
		expect(goalReachedText({ earned: 160, goal: 200 })).toBe(
			'160 / 200 Points reached',
		);
		expect(goalLeftText({ remaining: 40, reached: false })).toBe(
			'40 points left before the next reward unlock.',
		);
		expect(goalLeftText({ remaining: 1, reached: false })).toContain(
			'1 point left',
		);
		expect(goalLeftText({ remaining: 0, reached: true })).toBe(
			'Weekly goal reached. Great job!',
		);
	});
});

describe('confettiPieces', () => {
	it('is a fixed set inside the 140px square, so snapshots never change', () => {
		expect(confettiPieces.length).toBeGreaterThan(0);
		for (const p of confettiPieces) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.x + p.width).toBeLessThanOrEqual(140);
			expect(p.y + p.height).toBeLessThanOrEqual(140);
		}
	});
});
