import { describe, expect, it } from 'vitest';
import {
	doneByText,
	doneForText,
	favourBannerTitle,
	possessive,
	reopenFavourText,
} from './favour.ts';

describe('favour copy', () => {
	it('names the owner and the doer', () => {
		expect(possessive('Leo')).toBe("Leo's");
		expect(favourBannerTitle('Leo')).toBe("This is Leo's chore.");
		expect(doneByText('Mia')).toBe('Done by Mia');
	});

	it('says who gets the points and whose chore is covered', () => {
		expect(doneForText(10, 'Leo')).toBe(
			"+10 points for you. Leo's chore is covered 🎉",
		);
		expect(doneForText(1, 'Leo')).toContain('+1 point for you');
	});

	it('says the points come back off the doer on reopen', () => {
		expect(reopenFavourText(10, 'Mia')).toBe(
			'Reopening takes the 10 pts back from Mia.',
		);
	});
});
