import {
	MAX_EXCLUSION_REASON_LENGTH,
	MIN_ELIGIBLE_ROTATION_MEMBERS,
	type RotationIssue,
	validateRotation,
} from '@chore/db/rotation';

// What the Rotation Loops Builder (SB-50) shows and edits, as plain data that
// the server load, the card, and the tests all share. No server imports here:
// this file is bundled into the client.

export type RotationScope = 'whole_household' | 'eligible_subset';

/** Longest `scope_label` the database accepts (after trimming). */
export const MAX_SCOPE_LABEL_LENGTH = 40;

export interface LoopMember {
	memberId: string;
	name: string;
	/** Turn order, from 1. */
	position: number;
	eligible: boolean;
	exclusionReason: string | null;
}

export interface RotationLoop {
	choreId: string;
	title: string;
	description: string | null;
	points: number;
	scope: RotationScope;
	scopeLabel: string | null;
	currentMemberId: string | null;
	/** Every member, in turn order, excluded ones included. */
	members: LoopMember[];
}

/** What a parent can change on a loop; the rest is read-only here. */
export interface LoopDraft {
	scope: RotationScope;
	scopeLabel: string | null;
	members: LoopMember[];
}

export interface SaveLoopInput {
	choreId: string;
	scope: RotationScope;
	scopeLabel: string | null;
	members: {
		memberId: string;
		position: number;
		eligible: boolean;
		exclusionReason: string | null;
	}[];
}

export const draftOf = (loop: RotationLoop): LoopDraft => ({
	scope: loop.scope,
	scopeLabel: loop.scopeLabel,
	members: loop.members.map((m) => ({ ...m })),
});

const byPosition = (a: LoopMember, b: LoopMember) => a.position - b.position;

/** Members in turn order, without changing the input. */
export const inOrder = (members: readonly LoopMember[]): LoopMember[] =>
	[...members].sort(byPosition);

export const eligibleMembers = (members: readonly LoopMember[]) =>
	inOrder(members).filter((m) => m.eligible);

export const excludedMembers = (members: readonly LoopMember[]) =>
	inOrder(members).filter((m) => !m.eligible);

/** "Leo", "Leo and Mia", "Mom, Dad, and Leo". */
export function joinNames(names: readonly string[]): string {
	if (names.length <= 2) return names.join(' and ');
	return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** "2 eligible • 2 excluded" */
export const countsLabel = (members: readonly LoopMember[]) =>
	`${eligibleMembers(members).length} eligible • ${excludedMembers(members).length} excluded`;

/** "Leo → Mia → loop reset" */
export function orderSummary(members: readonly LoopMember[]): string {
	const names = eligibleMembers(members).map((m) => m.name);
	return [...names, 'loop reset'].join(' → ');
}

/**
 * Moves a member one step up or down the turn order, then renumbers the
 * positions 1..n (the database allows gaps, but a swap is simpler to reason
 * about and to compare). Returns the same list when there's nowhere to go.
 */
export function moveMember(
	members: readonly LoopMember[],
	memberId: string,
	direction: 'up' | 'down',
): LoopMember[] {
	const ordered = inOrder(members);
	const from = ordered.findIndex((m) => m.memberId === memberId);
	const to = direction === 'up' ? from - 1 : from + 1;
	if (from === -1 || to < 0 || to >= ordered.length) return [...members];
	[ordered[from], ordered[to]] = [ordered[to], ordered[from]];
	return ordered.map((m, i) => ({ ...m, position: i + 1 }));
}

/**
 * Includes or excludes a member. Including clears the reason (the database
 * requires NULL for eligible members); excluding starts from an empty reason
 * the parent has to fill in.
 */
export function setEligible(
	members: readonly LoopMember[],
	memberId: string,
	eligible: boolean,
): LoopMember[] {
	return members.map((m) =>
		m.memberId !== memberId
			? m
			: {
					...m,
					eligible,
					exclusionReason: eligible ? null : (m.exclusionReason ?? ''),
				},
	);
}

export function setReason(
	members: readonly LoopMember[],
	memberId: string,
	reason: string,
): LoopMember[] {
	return members.map((m) =>
		m.memberId === memberId ? { ...m, exclusionReason: reason } : m,
	);
}

const normalizedLabel = (label: string | null | undefined) =>
	label?.trim() ? label.trim() : null;

/** The save payload for a draft: trimmed, with reasons only on excluded members. */
export function toSaveInput(choreId: string, draft: LoopDraft): SaveLoopInput {
	return {
		choreId,
		scope: draft.scope,
		scopeLabel:
			draft.scope === 'eligible_subset'
				? normalizedLabel(draft.scopeLabel)
				: null,
		members: inOrder(draft.members).map((m, i) => ({
			memberId: m.memberId,
			position: i + 1,
			eligible: m.eligible,
			exclusionReason: m.eligible ? null : (m.exclusionReason?.trim() ?? ''),
		})),
	};
}

/** Whether the draft differs from what's saved. */
export function isDirty(loop: RotationLoop, draft: LoopDraft): boolean {
	const saved = JSON.stringify(toSaveInput(loop.choreId, draftOf(loop)));
	return saved !== JSON.stringify(toSaveInput(loop.choreId, draft));
}

export interface LoopProblems {
	/** Problems with the loop as a whole. */
	loop: string[];
	/** Problems by member id (a missing or too-long reason). */
	members: Record<string, string>;
}

/**
 * The same rules the database enforces at commit (see `validateRotation`),
 * as messages for the card. A reason is only flagged once the member is
 * excluded.
 */
export function problemsFor(draft: LoopDraft): LoopProblems {
	const input = toSaveInput('', draft);
	const issues = validateRotation(input.members);
	return describeIssues(issues);
}

export function describeIssues(issues: readonly RotationIssue[]): LoopProblems {
	const problems: LoopProblems = { loop: [], members: {} };
	for (const issue of issues) {
		switch (issue.code) {
			case 'too_few_eligible':
				problems.loop.push(
					`Keep at least ${MIN_ELIGIBLE_ROTATION_MEMBERS} members eligible so the turn has somewhere to go (${issue.eligibleCount} now).`,
				);
				break;
			case 'missing_exclusion_reason':
				problems.members[issue.memberId] = 'Add a reason for excluding them.';
				break;
			case 'exclusion_reason_too_long':
				problems.members[issue.memberId] =
					`Keep the reason under ${MAX_EXCLUSION_REASON_LENGTH} characters.`;
				break;
			default:
				// Duplicate members/positions can't come from the card; surface them
				// rather than hide a bug.
				problems.loop.push('This loop can not be saved. Reload and try again.');
		}
	}
	return problems;
}

/** The line under the scope chips: who takes turns, in plain words. */
export function scopeExplanation(
	scope: RotationScope,
	members: readonly LoopMember[],
): string {
	const names = eligibleMembers(members).map((m) => m.name);
	if (names.length === 0) return 'Nobody is eligible for this chore yet.';
	if (scope === 'whole_household') {
		return `Everyone in the household takes turns: ${joinNames(names)}.`;
	}
	return `${joinNames(names)} rotate this chore together.`;
}

/** The sentence under the Assignment Order Preview chain. */
export function orderExplanation(members: readonly LoopMember[]): string {
	const eligible = eligibleMembers(members);
	if (eligible.length < MIN_ELIGIBLE_ROTATION_MEMBERS) {
		return 'Add at least two eligible members to preview the assignment order.';
	}
	const last = eligible[eligible.length - 1];
	const [first, second] = eligible;
	return `Preview the next assignment before the loop advances. ${first.name} completes the current turn, then ${second.name} becomes the next active member automatically. After ${last.name} completes the turn, the loop resets back to ${first.name}.`;
}

/** One entry of "Current Loop Examples", generated from a real loop. */
export interface LoopExample {
	choreId: string;
	title: string;
	scope: RotationScope;
	eligible: string;
	/** Excluded members with their reasons; empty when everyone's in. */
	excluded: { name: string; reason: string }[];
	order: string;
}

export const loopExample = (loop: RotationLoop): LoopExample => ({
	choreId: loop.choreId,
	title: loop.title,
	scope: loop.scope,
	eligible: eligibleMembers(loop.members)
		.map((m) => m.name)
		.join(', '),
	excluded: excludedMembers(loop.members).map((m) => ({
		name: m.name,
		reason: m.exclusionReason ?? '',
	})),
	order: orderSummary(loop.members),
});

export const scopeName = (scope: RotationScope) =>
	scope === 'whole_household' ? 'Whole Household' : 'Eligible Subset';

const MEMBER_TONES = ['orange', 'blue', 'green', 'amber'] as const;
export type MemberTone = (typeof MEMBER_TONES)[number];

/** A stable avatar colour for a member, so they look the same on every card. */
export function memberTone(memberId: string): MemberTone {
	let sum = 0;
	for (const ch of memberId) sum += ch.charCodeAt(0);
	return MEMBER_TONES[sum % MEMBER_TONES.length];
}

/**
 * Why a save request can't be applied to `loop`, worded for the card, or null
 * when it can. The member list is fixed (adding someone belongs to the Chore
 * Creator), so the input has to name exactly the members already in the loop.
 */
export function saveInputError(
	loop: Pick<RotationLoop, 'members'>,
	input: SaveLoopInput,
): string | null {
	const known = new Set(loop.members.map((m) => m.memberId));
	const sent = new Set(input.members.map((m) => m.memberId));
	if (
		input.members.length !== sent.size ||
		known.size !== sent.size ||
		[...known].some((id) => !sent.has(id))
	) {
		return 'The members changed since this page loaded. Reload and try again.';
	}
	if (input.scope !== 'whole_household' && input.scope !== 'eligible_subset') {
		return 'Choose Whole Household or Eligible Subset.';
	}
	if (
		input.scope === 'eligible_subset' &&
		(input.scopeLabel?.trim().length ?? 0) > MAX_SCOPE_LABEL_LENGTH
	) {
		return `Keep the label to ${MAX_SCOPE_LABEL_LENGTH} characters or fewer.`;
	}
	const problems = describeIssues(validateRotation(input.members));
	return problems.loop[0] ?? Object.values(problems.members)[0] ?? null;
}
