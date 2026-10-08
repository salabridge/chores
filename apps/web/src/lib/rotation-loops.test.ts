import { describe, expect, it } from 'vitest';
import {
	countsLabel,
	draftOf,
	isDirty,
	joinNames,
	type LoopMember,
	loopExample,
	memberTone,
	moveMember,
	orderExplanation,
	orderSummary,
	problemsFor,
	type RotationLoop,
	type SaveLoopInput,
	saveInputError,
	scopeExplanation,
	setEligible,
	setReason,
	toSaveInput,
} from './rotation-loops.ts';

const member = (
	memberId: string,
	position: number,
	o: Partial<LoopMember> = {},
): LoopMember => ({
	memberId,
	name: memberId[0].toUpperCase() + memberId.slice(1),
	position,
	eligible: true,
	exclusionReason: null,
	...o,
});

const toilet: RotationLoop = {
	choreId: 'c1',
	title: 'Shared Bathroom Toilet',
	description: null,
	points: 20,
	scope: 'eligible_subset',
	scopeLabel: 'Kids only',
	currentMemberId: 'leo',
	members: [
		member('leo', 1),
		member('mia', 2),
		member('mom', 3, { eligible: false, exclusionReason: 'Parents sit out' }),
		member('dad', 4, { eligible: false, exclusionReason: 'Parents sit out' }),
	],
};

describe('summaries', () => {
	it('joins names the way the Figma copy reads', () => {
		expect(joinNames(['Leo'])).toBe('Leo');
		expect(joinNames(['Leo', 'Mia'])).toBe('Leo and Mia');
		expect(joinNames(['Mom', 'Dad', 'Leo'])).toBe('Mom, Dad, and Leo');
	});

	it('counts eligible and excluded members', () => {
		expect(countsLabel(toilet.members)).toBe('2 eligible • 2 excluded');
	});

	it('summarizes the order, skipping excluded members', () => {
		expect(orderSummary(toilet.members)).toBe('Leo → Mia → loop reset');
	});

	it('explains the scope from who is eligible', () => {
		expect(scopeExplanation('eligible_subset', toilet.members)).toBe(
			'Leo and Mia rotate this chore together.',
		);
		expect(scopeExplanation('whole_household', toilet.members)).toBe(
			'Everyone in the household takes turns: Leo and Mia.',
		);
		expect(scopeExplanation('whole_household', [])).toBe(
			'Nobody is eligible for this chore yet.',
		);
	});

	it('explains the handoff, and asks for more members when there are too few', () => {
		expect(orderExplanation(toilet.members)).toContain(
			'Leo completes the current turn, then Mia becomes the next active member',
		);
		expect(orderExplanation(toilet.members)).toContain(
			'After Mia completes the turn, the loop resets back to Leo.',
		);
		expect(orderExplanation([member('leo', 1)])).toMatch(/at least two/);
	});

	it('builds a loop example from the real loop', () => {
		expect(loopExample(toilet)).toEqual({
			choreId: 'c1',
			title: 'Shared Bathroom Toilet',
			scope: 'eligible_subset',
			eligible: 'Leo, Mia',
			excluded: [
				{ name: 'Mom', reason: 'Parents sit out' },
				{ name: 'Dad', reason: 'Parents sit out' },
			],
			order: 'Leo → Mia → loop reset',
		});
	});
});

describe('editing', () => {
	it('moves a member and renumbers positions', () => {
		const moved = moveMember(toilet.members, 'mia', 'up');
		expect(moved.map((m) => [m.memberId, m.position])).toEqual([
			['mia', 1],
			['leo', 2],
			['mom', 3],
			['dad', 4],
		]);
	});

	it('does nothing at the ends', () => {
		expect(
			moveMember(toilet.members, 'leo', 'up').map((m) => m.memberId),
		).toEqual(['leo', 'mia', 'mom', 'dad']);
		expect(
			moveMember(toilet.members, 'dad', 'down').map((m) => m.memberId),
		).toEqual(['leo', 'mia', 'mom', 'dad']);
		expect(moveMember(toilet.members, 'nobody', 'up')).toHaveLength(4);
	});

	it('does not mutate its input', () => {
		const before = JSON.stringify(toilet.members);
		moveMember(toilet.members, 'mia', 'up');
		setEligible(toilet.members, 'mia', false);
		setReason(toilet.members, 'mom', 'x');
		expect(JSON.stringify(toilet.members)).toBe(before);
	});

	it('clears the reason when included and starts empty when excluded', () => {
		const included = setEligible(toilet.members, 'mom', true).find(
			(m) => m.memberId === 'mom',
		);
		expect(included).toMatchObject({ eligible: true, exclusionReason: null });
		const excluded = setEligible(toilet.members, 'mia', false).find(
			(m) => m.memberId === 'mia',
		);
		expect(excluded).toMatchObject({ eligible: false, exclusionReason: '' });
	});

	it('keeps a typed reason on an excluded member', () => {
		let members = setEligible(toilet.members, 'mia', false);
		members = setReason(members, 'mia', 'Too young');
		expect(members.find((m) => m.memberId === 'mia')?.exclusionReason).toBe(
			'Too young',
		);
	});
});

describe('draft state', () => {
	it('is clean until something changes', () => {
		expect(isDirty(toilet, draftOf(toilet))).toBe(false);
	});

	it('is dirty after a reorder, a toggle, or a scope change', () => {
		const reordered = draftOf(toilet);
		reordered.members = moveMember(reordered.members, 'mia', 'up');
		expect(isDirty(toilet, reordered)).toBe(true);

		const toggled = draftOf(toilet);
		toggled.members = setEligible(toggled.members, 'mom', true);
		expect(isDirty(toilet, toggled)).toBe(true);

		const rescoped = draftOf(toilet);
		rescoped.scope = 'whole_household';
		expect(isDirty(toilet, rescoped)).toBe(true);
	});

	it('ignores whitespace-only differences in a reason', () => {
		const draft = draftOf(toilet);
		draft.members = setReason(draft.members, 'mom', '  Parents sit out ');
		expect(isDirty(toilet, draft)).toBe(false);
	});

	it('drops the label when the scope is the whole household', () => {
		const draft = draftOf(toilet);
		draft.scope = 'whole_household';
		expect(toSaveInput('c1', draft).scopeLabel).toBeNull();
	});

	it('trims the label and turns a blank one into null', () => {
		const draft = draftOf(toilet);
		draft.scopeLabel = '  Kids  ';
		expect(toSaveInput('c1', draft).scopeLabel).toBe('Kids');
		draft.scopeLabel = '   ';
		expect(toSaveInput('c1', draft).scopeLabel).toBeNull();
	});

	it('sends reasons only for excluded members, in order from 1', () => {
		const draft = draftOf(toilet);
		draft.members = moveMember(draft.members, 'dad', 'up');
		const input = toSaveInput('c1', draft);
		expect(input.members.map((m) => [m.memberId, m.position])).toEqual([
			['leo', 1],
			['mia', 2],
			['dad', 3],
			['mom', 4],
		]);
		expect(input.members.find((m) => m.memberId === 'leo')).toMatchObject({
			eligible: true,
			exclusionReason: null,
		});
	});
});

describe('problemsFor', () => {
	it('is clean for a valid loop', () => {
		expect(problemsFor(draftOf(toilet))).toEqual({ loop: [], members: {} });
	});

	it('flags an excluded member with no reason', () => {
		const draft = draftOf(toilet);
		draft.members = setEligible(draft.members, 'mia', false);
		// Leo is now the only eligible member, so the loop is flagged as well.
		const problems = problemsFor(draft);
		expect(problems.members.mia).toMatch(/reason/i);
		expect(problems.loop[0]).toMatch(/at least 2/);
	});

	it('flags a whitespace-only reason', () => {
		const draft = draftOf(toilet);
		draft.members = setReason(draft.members, 'mom', '   ');
		expect(problemsFor(draft).members.mom).toMatch(/reason/i);
	});

	it('flags too few eligible members', () => {
		const draft = draftOf(toilet);
		draft.members = setEligible(draft.members, 'mia', false);
		draft.members = setReason(draft.members, 'mia', 'Away');
		expect(problemsFor(draft).loop).toHaveLength(1);
	});

	it('flags a reason that is too long', () => {
		const draft = draftOf(toilet);
		draft.members = setReason(draft.members, 'mom', 'x'.repeat(201));
		expect(problemsFor(draft).members.mom).toMatch(/200/);
	});
});

describe('saveInputError', () => {
	const valid = (): SaveLoopInput => toSaveInput('c1', draftOf(toilet));

	it('accepts a valid save', () => {
		expect(saveInputError(toilet, valid())).toBeNull();
	});

	it('rejects a member list that changed', () => {
		const missing = valid();
		missing.members.pop();
		expect(saveInputError(toilet, missing)).toMatch(/members changed/);

		const extra = valid();
		extra.members.push({
			memberId: 'zed',
			position: 5,
			eligible: true,
			exclusionReason: null,
		});
		expect(saveInputError(toilet, extra)).toMatch(/members changed/);

		const duplicated = valid();
		duplicated.members[1] = { ...duplicated.members[0] };
		expect(saveInputError(toilet, duplicated)).toMatch(/members changed/);
	});

	it('rejects an unknown scope', () => {
		const input = { ...valid(), scope: 'everyone' as never };
		expect(saveInputError(toilet, input)).toMatch(/Whole Household/);
	});

	it('rejects a label over 40 characters', () => {
		const input = { ...valid(), scopeLabel: 'x'.repeat(41) };
		expect(saveInputError(toilet, input)).toMatch(/40/);
	});

	it('rejects fewer than two eligible members', () => {
		const input = valid();
		input.members = input.members.map((m) =>
			m.memberId === 'mia'
				? { ...m, eligible: false, exclusionReason: 'Away' }
				: m,
		);
		expect(saveInputError(toilet, input)).toMatch(/at least 2/);
	});

	it('rejects a missing exclusion reason', () => {
		const input = valid();
		input.members = input.members.map((m) =>
			m.memberId === 'mom' ? { ...m, exclusionReason: ' ' } : m,
		);
		expect(saveInputError(toilet, input)).toMatch(/reason/i);
	});

	it('rejects duplicate positions', () => {
		const input = valid();
		input.members[1].position = 1;
		expect(saveInputError(toilet, input)).not.toBeNull();
	});
});

describe('memberTone', () => {
	it('is stable per member and always a known tone', () => {
		expect(memberTone('abc')).toBe(memberTone('abc'));
		expect(['orange', 'blue', 'green', 'amber']).toContain(memberTone('xyz'));
	});
});
