import { validateRotation } from '@chore/db/rotation';
import {
	type ChoreDraft,
	type CreateChoreInput,
	createInputError,
	type MemberOption,
	stagesSummary,
	toCreateInput,
} from './chore-creator.ts';
import {
	describeIssues,
	eligibleMembers,
	excludedMembers,
	type LoopMember,
	type SaveLoopInput,
	toSaveInput,
} from './rotation-loops.ts';

// What the Chore Creator's Eligibility Setup panel (SB-49) edits and sends, as
// plain data shared by the panel, the remote function, and the tests. The
// member list, order, and exclusion rules are the Rotation Loops Builder's
// (rotation-loops.ts), so both screens enforce the same thing.

/** What the server accepts to create a household rotation chore. */
export interface CreateRotationChoreInput {
	chore: CreateChoreInput;
	/** Everyone in the household, in turn order, with who is excluded and why. */
	members: SaveLoopInput['members'];
}

/** The default loop: every household member, eligible, in household order. */
export const defaultRotationMembers = (
	members: readonly MemberOption[],
): LoopMember[] =>
	members.map((m, i) => ({
		memberId: m.id,
		name: m.name,
		position: i + 1,
		eligible: true,
		exclusionReason: null,
	}));

export const toCreateRotationInput = (
	draft: ChoreDraft,
	members: readonly LoopMember[],
): CreateRotationChoreInput => ({
	chore: toCreateInput({ ...draft, kind: 'rotation' }),
	members: toSaveInput('', {
		scope: 'whole_household',
		scopeLabel: null,
		members: [...members],
	}).members,
});

/** "3 members eligible, 1 excluded" for "Before you continue". */
export function eligibilityLine(members: readonly LoopMember[]): string {
	const eligible = eligibleMembers(members).length;
	const excluded = excludedMembers(members).length;
	const noun = eligible === 1 ? 'member' : 'members';
	return `${eligible} ${noun} eligible, ${excluded} excluded`;
}

/** The blue callout at the top of the panel. */
export function eligibilityCallout(members: readonly LoopMember[]): string {
	return `Household rotations need at least two eligible members. This chore currently has ${eligibleMembers(members).length} eligible and ${excludedMembers(members).length} excluded.`;
}

/** The "Before you continue" lines, in order. */
export function reviewLines(
	draft: ChoreDraft,
	members: readonly LoopMember[],
	frequency: string,
): { tone: 'green' | 'orange' | 'blue'; text: string }[] {
	return [
		{ tone: 'green', text: 'Chore type: Household Rotation' },
		{ tone: 'orange', text: `Frequency: ${frequency}` },
		{ tone: 'orange', text: `Stages: ${stagesSummary(draft)}` },
		{ tone: 'blue', text: `Eligibility: ${eligibilityLine(members)}` },
	];
}

/**
 * Why a rotation save request can't be applied, worded for the panel, or null.
 * `knownMemberIds` is the household; the request must name exactly those
 * members (adding or removing people is not done from here).
 */
export function rotationInputError(
	input: CreateRotationChoreInput,
	knownMemberIds?: readonly string[],
): string | null {
	if (input.chore?.kind !== 'rotation')
		return 'This is not a household rotation.';
	const choreProblem = createInputError(input.chore);
	if (choreProblem) return choreProblem;
	if (!Array.isArray(input.members)) return 'The members are not valid.';
	if (knownMemberIds) {
		const sent = new Set(input.members.map((m) => m.memberId));
		if (
			sent.size !== input.members.length ||
			sent.size !== knownMemberIds.length ||
			knownMemberIds.some((id) => !sent.has(id))
		) {
			return 'The household members changed since this page loaded. Reload and try again.';
		}
	}
	const problems = describeIssues(validateRotation(input.members));
	return problems.loop[0] ?? Object.values(problems.members)[0] ?? null;
}
