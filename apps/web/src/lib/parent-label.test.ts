import { describe, expect, it } from 'vitest';
import { parentLabel } from './parent-label.ts';

describe('parentLabel', () => {
	it('joins two parents with an ampersand', () => {
		expect(parentLabel(['Mom', 'Dad'])).toEqual({
			name: 'Mom & Dad',
			role: 'Co-Captains',
		});
	});
	it('uses commas for three or more', () => {
		expect(parentLabel(['Mom', 'Dad', 'Gran']).name).toBe('Mom, Dad & Gran');
	});
	it('handles a single parent', () => {
		expect(parentLabel(['Sam'])).toEqual({ name: 'Sam', role: 'Captain' });
	});
	it('falls back when there are no names', () => {
		expect(parentLabel([' '])).toEqual({ name: 'Parent', role: 'Captain' });
	});
});
