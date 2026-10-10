import { describe, expect, it } from 'vitest';
import { exampleDraft } from './chore-creator.ts';
import {
	type CreateRotationChoreInput,
	defaultRotationMembers,
	eligibilityCallout,
	eligibilityLine,
	reviewLines,
	rotationInputError,
	toCreateRotationInput,
} from './chore-eligibility.ts';
import { moveMember, setEligible, setReason } from './rotation-loops.ts';

const household = [
	{ id: 'mom', name: 'Mom' },
	{ id: 'dad', name: 'Dad' },
	{ id: 'leo', name: 'Leo' },
	{ id: 'mia', name: 'Mia' },
];
const ids = household.map((m) => m.id);

describe('defaultRotationMembers', () => {
	it('is everyone, eligible, in household order from 1', () => {
		expect(defaultRotationMembers(household)).toEqual(
			household.map((m, i) => ({
				memberId: m.id,
				name: m.name,
				position: i + 1,
				eligible: true,
				exclusionReason: null,
			})),
		);
	});
});

describe('summaries', () => {
	const loop = setReason(
		setEligible(defaultRotationMembers(household), 'mia', false),
		'mia',
		'Too young',
	);

	it('counts eligible and excluded', () => {
		expect(eligibilityLine(loop)).toBe('3 members eligible, 1 excluded');
		expect(eligibilityCallout(loop)).toBe(
			'Household rotations need at least two eligible members. This chore currently has 3 eligible and 1 excluded.',
		);
	});

	it('lists the Before you continue lines', () => {
		expect(
			reviewLines(exampleDraft(), loop, 'Daily • 15 pts').map((l) => l.text),
		).toEqual([
			'Chore type: Household Rotation',
			'Frequency: Daily • 15 pts',
			'Stages: 3 stages, 15 total points',
			'Eligibility: 3 members eligible, 1 excluded',
		]);
	});
});

describe('toCreateRotationInput', () => {
	it('sends the chore as a rotation and the members in the order shown', () => {
		const loop = moveMember(defaultRotationMembers(household), 'mom', 'down');
		const input = toCreateRotationInput(
			{ ...exampleDraft(), assigneeId: 'leo' },
			loop,
		);
		expect(input.chore.kind).toBe('rotation');
		expect(input.chore.assigneeId).toBeNull();
		expect(input.members.map((m) => m.memberId)).toEqual([
			'dad',
			'mom',
			'leo',
			'mia',
		]);
	});

	it('clears reasons on eligible members and trims the rest', () => {
		const loop = setReason(
			setEligible(defaultRotationMembers(household), 'mia', false),
			'mia',
			'  Too young ',
		);
		const mia = toCreateRotationInput(exampleDraft(), loop).members[3];
		expect(mia).toEqual({
			memberId: 'mia',
			position: 4,
			eligible: false,
			exclusionReason: 'Too young',
		});
	});
});

describe('rotationInputError', () => {
	const input = () =>
		toCreateRotationInput(exampleDraft(), defaultRotationMembers(household));

	it('accepts a valid rotation for exactly the household', () => {
		expect(rotationInputError(input(), ids)).toBeNull();
	});

	it('refuses personal chores', () => {
		const bad = input();
		bad.chore = { ...bad.chore, kind: 'personal' };
		expect(rotationInputError(bad, ids)).toBeTruthy();
	});

	it('refuses fewer than two eligible members', () => {
		const loop = defaultRotationMembers(household).map((m, i) =>
			i === 0 ? m : { ...m, eligible: false, exclusionReason: 'No' },
		);
		expect(
			rotationInputError(toCreateRotationInput(exampleDraft(), loop), ids),
		).toMatch(/at least 2 members eligible/);
	});

	it('refuses an exclusion without a reason', () => {
		const loop = setEligible(defaultRotationMembers(household), 'mia', false);
		expect(
			rotationInputError(toCreateRotationInput(exampleDraft(), loop), ids),
		).toBe('Add a reason for excluding them.');
	});

	it('refuses members that are not the household', () => {
		const extra = input();
		extra.members.push({
			memberId: 'stranger',
			position: 5,
			eligible: true,
			exclusionReason: null,
		});
		expect(rotationInputError(extra, ids)).toMatch(/changed since/);
		const missing = input();
		missing.members.pop();
		expect(rotationInputError(missing, ids)).toMatch(/changed since/);
	});

	it('refuses an invalid chore', () => {
		const bad = input();
		bad.chore = { ...bad.chore, title: '' };
		expect(rotationInputError(bad, ids)).toBeTruthy();
	});

	it('refuses malformed input with a message instead of throwing', () => {
		const malformed = (members: unknown) =>
			({ ...input(), members }) as unknown as CreateRotationChoreInput;
		const badShape = [
			{ memberId: 'x', position: 1, eligible: false, exclusionReason: 5 },
		];
		expect(rotationInputError(malformed(badShape), ids)).toBe(
			'The members are not valid.',
		);
		expect(rotationInputError(malformed([null]), ids)).toBe(
			'The members are not valid.',
		);
		expect(
			rotationInputError(null as unknown as CreateRotationChoreInput, ids),
		).toBe('This is not a household rotation.');
	});
});
