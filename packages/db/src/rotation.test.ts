import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	nextEligibleMember,
	type RotationMemberInput,
	type RotationSlot,
	rotationHandoffChain,
	rotationTurns,
	validateRotation,
} from './rotation.ts';

// Ava, Ben, Cy (excluded), Dee: the loop is Ava -> Ben -> Dee -> Ava.
// Listed out of order to check that position, not array order, decides.
const members: RotationSlot[] = [
	{ memberId: 'dee', position: 4, eligible: true },
	{ memberId: 'ava', position: 1, eligible: true },
	{ memberId: 'cy', position: 3, eligible: false },
	{ memberId: 'ben', position: 2, eligible: true },
];

const ids = (chain: { member: RotationSlot }[]) =>
	chain.map((step) => step.member.memberId);

test('advance moves to the next eligible member by position', () => {
	assert.deepEqual(nextEligibleMember(members, 'ava'), {
		member: members[3],
		wrapped: false,
	});
});

test('advance skips excluded members', () => {
	const next = nextEligibleMember(members, 'ben');
	assert.equal(next?.member.memberId, 'dee');
	assert.equal(next?.wrapped, false);
});

test('advance wraps from the last eligible member to the first (Loop Reset)', () => {
	const next = nextEligibleMember(members, 'dee');
	assert.equal(next?.member.memberId, 'ava');
	assert.equal(next?.wrapped, true);
});

test('advance wraps past excluded members at the start of the loop', () => {
	const loop: RotationSlot[] = [
		{ memberId: 'a', position: 1, eligible: false },
		{ memberId: 'b', position: 2, eligible: true },
		{ memberId: 'c', position: 3, eligible: true },
	];
	assert.deepEqual(nextEligibleMember(loop, 'c'), {
		member: loop[1],
		wrapped: true,
	});
});

test('advance from an excluded member goes to the next eligible one after them', () => {
	// The database does this when the current member is excluded mid-turn.
	assert.equal(nextEligibleMember(members, 'cy')?.member.memberId, 'dee');
});

test('gaps in positions are fine', () => {
	const loop: RotationSlot[] = [
		{ memberId: 'a', position: 10, eligible: true },
		{ memberId: 'b', position: 20, eligible: true },
	];
	assert.equal(nextEligibleMember(loop, 'a')?.member.memberId, 'b');
	assert.equal(nextEligibleMember(loop, 'b')?.wrapped, true);
});

test('with no current member the turn starts at the first eligible member', () => {
	assert.deepEqual(nextEligibleMember(members, null), {
		member: members[1],
		wrapped: false,
	});
	assert.equal(nextEligibleMember(members, 'stranger')?.member.memberId, 'ava');
});

test('a single eligible member keeps the turn; none means no turn', () => {
	const solo: RotationSlot[] = [
		{ memberId: 'a', position: 1, eligible: true },
		{ memberId: 'b', position: 2, eligible: false },
	];
	assert.deepEqual(nextEligibleMember(solo, 'a'), {
		member: solo[0],
		wrapped: true,
	});
	assert.equal(nextEligibleMember([{ ...solo[1], position: 1 }], 'b'), null);
});

test('the handoff chain covers one loop and marks the Loop Reset', () => {
	const chain = rotationHandoffChain(members, 'ben');
	assert.deepEqual(ids(chain), ['ben', 'dee', 'ava']);
	assert.deepEqual(
		chain.map((step) => step.loopReset),
		[false, false, true],
	);
	assert.deepEqual(ids(rotationHandoffChain(members, 'ben', 5)), [
		'ben',
		'dee',
		'ava',
		'ben',
		'dee',
	]);
	assert.deepEqual(rotationHandoffChain([], null), []);
});

test('Done Last / Active Turn / Next Up', () => {
	const turns = rotationTurns(members, 'dee', 'ben');
	assert.equal(turns.doneLast?.memberId, 'ben');
	assert.equal(turns.activeTurn?.memberId, 'dee');
	assert.equal(turns.nextUp?.memberId, 'ava');
	assert.equal(turns.nextUpIsLoopReset, true);
	assert.deepEqual(ids(turns.handoffChain), ['dee', 'ava', 'ben']);
	assert.equal(turns.eligibleCount, 3);
	assert.equal(turns.isValid, true);
});

test('a new rotation has no Done Last', () => {
	const turns = rotationTurns(members, 'ava', null);
	assert.equal(turns.doneLast, null);
	assert.equal(turns.activeTurn?.memberId, 'ava');
	assert.equal(turns.nextUp?.memberId, 'ben');
	assert.equal(turns.nextUpIsLoopReset, false);
});

test('an excluded or missing current member shows the first eligible as Active Turn', () => {
	assert.equal(rotationTurns(members, 'cy', null).activeTurn?.memberId, 'ava');
	assert.equal(rotationTurns(members, null, null).activeTurn?.memberId, 'ava');
});

test('a loop left with one eligible member is flagged invalid', () => {
	const degraded = members.map((m) =>
		m.memberId === 'ava' ? m : { ...m, eligible: false },
	);
	const turns = rotationTurns(degraded, 'ava', null);
	assert.equal(turns.eligibleCount, 1);
	assert.equal(turns.isValid, false);
	assert.equal(turns.nextUp?.memberId, 'ava');
});

const valid: RotationMemberInput[] = [
	{ memberId: 'ava', position: 1, eligible: true },
	{ memberId: 'ben', position: 2, eligible: true },
	{
		memberId: 'cy',
		position: 3,
		eligible: false,
		exclusionReason: 'Too young for hot-water handling',
	},
];

test('a rotation with 2+ eligible members and reasons for exclusions is valid', () => {
	assert.deepEqual(validateRotation(valid), []);
	assert.deepEqual(validateRotation(valid, 'ben'), []);
});

test('fewer than 2 eligible members is blocked', () => {
	const one = valid.map((m) =>
		m.memberId === 'ben'
			? { ...m, eligible: false, exclusionReason: 'Away at college' }
			: m,
	);
	assert.deepEqual(validateRotation(one), [
		{ code: 'too_few_eligible', eligibleCount: 1 },
	]);
	assert.deepEqual(validateRotation([]), [
		{ code: 'too_few_eligible', eligibleCount: 0 },
	]);
});

test('an excluded member needs a reason; an eligible one must not have one', () => {
	const issues = validateRotation([
		{ memberId: 'ava', position: 1, eligible: true, exclusionReason: 'x' },
		{ memberId: 'ben', position: 2, eligible: true },
		{ memberId: 'cy', position: 3, eligible: false, exclusionReason: '  ' },
		{ memberId: 'dee', position: 4, eligible: false },
		{
			memberId: 'eve',
			position: 5,
			eligible: false,
			exclusionReason: 'x'.repeat(201),
		},
	]);
	assert.deepEqual(issues, [
		{ code: 'unexpected_exclusion_reason', memberId: 'ava' },
		{ code: 'missing_exclusion_reason', memberId: 'cy' },
		{ code: 'missing_exclusion_reason', memberId: 'dee' },
		{ code: 'exclusion_reason_too_long', memberId: 'eve' },
	]);
});

test('duplicate members, duplicate or invalid positions, and an ineligible turn are flagged', () => {
	const issues = validateRotation(
		[
			{ memberId: 'ava', position: 1, eligible: true },
			{ memberId: 'ava', position: 2, eligible: true },
			{ memberId: 'ben', position: 2, eligible: true },
			{ memberId: 'cy', position: 0, eligible: true },
		],
		'dee',
	);
	assert.deepEqual(issues, [
		{ code: 'duplicate_member', memberId: 'ava' },
		{ code: 'duplicate_position', position: 2 },
		{ code: 'invalid_position', memberId: 'cy' },
		{ code: 'current_not_eligible', memberId: 'dee' },
	]);
});
