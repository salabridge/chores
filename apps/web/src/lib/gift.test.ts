import { describe, expect, it } from 'vitest';
import {
	giftLine,
	MAX_GIFT_POINTS,
	MAX_GIFT_REASON,
	parseGiftInput,
} from './gift.ts';

const reason = 'Helped Grandma with groceries';

describe('parseGiftInput', () => {
	it('accepts whole numbers from 1 to 500, as text or a number', () => {
		expect(parseGiftInput({ points: '1', reason })).toEqual({
			ok: true,
			value: { points: 1, reason },
		});
		expect(parseGiftInput({ points: 500, reason }).ok).toBe(true);
		expect(parseGiftInput({ points: ' 20 ', reason })).toMatchObject({
			value: { points: 20 },
		});
	});

	it.each([
		'0',
		'-5',
		'501',
		'12.5',
		'1e2',
		'abc',
		'',
		' ',
		'0x10',
		'99999999999999999999',
	])('refuses %j points', (points) => {
		expect(parseGiftInput({ points, reason }).ok).toBe(false);
	});

	it('refuses points that are missing or not a string or number', () => {
		expect(parseGiftInput({ reason }).ok).toBe(false);
		expect(parseGiftInput({ points: null, reason }).ok).toBe(false);
		expect(parseGiftInput({ points: Number.NaN, reason }).ok).toBe(false);
		expect(parseGiftInput({ points: 2.5, reason }).ok).toBe(false);
		expect(parseGiftInput({ points: [20], reason }).ok).toBe(false);
	});

	it('names the limits in the message', () => {
		expect(parseGiftInput({ points: '900', reason })).toEqual({
			ok: false,
			message: `Give a whole number of points from 1 to ${MAX_GIFT_POINTS}.`,
		});
	});

	it('trims the reason and refuses an empty or blank one', () => {
		expect(
			parseGiftInput({ points: '5', reason: `  ${reason}  ` }),
		).toMatchObject({ value: { reason } });
		for (const blank of ['', '   ', undefined, 7]) {
			expect(parseGiftInput({ points: '5', reason: blank })).toEqual({
				ok: false,
				message: 'Say what the points are for.',
			});
		}
	});

	it('allows a reason of exactly 140 characters after trimming, no more', () => {
		const max = 'a'.repeat(MAX_GIFT_REASON);
		expect(parseGiftInput({ points: '5', reason: ` ${max} ` }).ok).toBe(true);
		expect(parseGiftInput({ points: '5', reason: `${max}a` }).ok).toBe(false);
	});
});

describe('giftLine', () => {
	it('shows points, reason and who gave them', () => {
		expect(giftLine({ points: 20, reason, fromName: 'Mom' })).toBe(
			'+20 · Helped Grandma with groceries · from Mom',
		);
	});

	it('leaves out the giver when they are gone', () => {
		expect(giftLine({ points: 5, reason: 'Report card', fromName: null })).toBe(
			'+5 · Report card',
		);
	});
});
