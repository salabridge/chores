import { describe, expect, it } from 'vitest';
import {
	confirmsHouseholdName,
	type MergeSummary,
	mergeDeletesText,
	mergeMovesText,
	signedInProblem,
} from './invite-accept.ts';

const invite = { email: 'Ava@Example.com' };

describe('signedInProblem', () => {
	it('lets a verified user with the invited email accept, ignoring case', () => {
		expect(
			signedInProblem(invite, {
				email: 'ava@example.com',
				emailVerified: true,
			}),
		).toBeNull();
	});

	it('flags a different email before an unverified one', () => {
		expect(
			signedInProblem(invite, {
				email: 'jim@example.com',
				emailVerified: false,
			}),
		).toBe('wrong-email');
		expect(
			signedInProblem(invite, {
				email: 'ava@example.com',
				emailVerified: false,
			}),
		).toBe('unverified');
	});
});

const merge = (names: string[]): MergeSummary => ({
	members: [
		{ displayName: 'Pat', points: 0, you: true },
		...names.map((displayName) => ({ displayName, points: 3, you: false })),
	],
	chores: 1,
	rewards: 0,
	completions: 12,
});

describe('mergeMovesText', () => {
	it('names everyone but the user', () => {
		expect(mergeMovesText(merge(['Mia', 'Leo', 'Sam']), 'Home')).toBe(
			'Mia, Leo and Sam will join Home with you; their points come with them.',
		);
		expect(mergeMovesText(merge(['Mia']), 'Home')).toBe(
			'Mia will join Home with you; their points come with them.',
		);
	});

	it('says when the user moves on their own', () => {
		expect(mergeMovesText(merge([]), 'Home')).toBe(
			"You'll join Home on your own.",
		);
	});
});

describe('mergeDeletesText', () => {
	it('counts what goes, singular and plural', () => {
		expect(mergeDeletesText(merge([]))).toBe(
			'Its 1 chore, 0 rewards and history (12 completed chores) are deleted. Streaks start fresh.',
		);
	});
});

describe('confirmsHouseholdName', () => {
	it('matches the name, ignoring case and surrounding spaces', () => {
		expect(confirmsHouseholdName('  pat place ', 'Pat Place')).toBe(true);
		expect(confirmsHouseholdName('Pat', 'Pat Place')).toBe(false);
		expect(confirmsHouseholdName('', 'Pat Place')).toBe(false);
		expect(confirmsHouseholdName(undefined, 'Pat Place')).toBe(false);
	});
});
