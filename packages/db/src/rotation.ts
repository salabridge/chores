// Turn-order math for rotation chores (SB-25), shared by the server and UI.
// Pure functions over a rotation's members; the database applies the same
// rules in app.advance_chore_rotation and its triggers (see
// ../migrations/0009_chore_rotation_turns.sql), so what the UI shows as "Next
// Up" is who the turn actually goes to.

/** A rotation needs at least this many eligible members to be saved. */
export const MIN_ELIGIBLE_ROTATION_MEMBERS = 2;

/** Longest `exclusion_reason` the database accepts (after trimming). */
export const MAX_EXCLUSION_REASON_LENGTH = 200;

/** The parts of a `chore_rotation_members` row the turn order depends on. */
export interface RotationSlot {
	memberId: string;
	/** Turn order, from 1 (gaps are fine). */
	position: number;
	eligible: boolean;
}

/** The members in turn order (by `position`), without changing the input. */
export function orderRotation<T extends RotationSlot>(
	members: readonly T[],
): T[] {
	return [...members].sort((a, b) => a.position - b.position);
}

/**
 * The member the turn goes to after `currentMemberId`: the next eligible one
 * by position, wrapping to the first eligible one ("Loop Reset", `wrapped`
 * true). Ineligible members are skipped. If `currentMemberId` is null or not
 * in the rotation, it starts from the top.
 *
 * With one eligible member it returns that member again (wrapped); with none
 * it returns null.
 */
export function nextEligibleMember<T extends RotationSlot>(
	members: readonly T[],
	currentMemberId: string | null,
): { member: T; wrapped: boolean } | null {
	const ordered = orderRotation(members);
	const eligible = ordered.filter((m) => m.eligible);
	if (eligible.length === 0) return null;
	const current = ordered.find((m) => m.memberId === currentMemberId);
	if (!current) return { member: eligible[0], wrapped: false };
	const after = eligible.find((m) => m.position > current.position);
	return after
		? { member: after, wrapped: false }
		: { member: eligible[0], wrapped: true };
}

/** One step of the handoff chain shown on the Overview. */
export interface RotationHandoff<T> {
	member: T;
	/** True on the step where the loop wraps back to the start ("Loop Reset"). */
	loopReset: boolean;
}

/**
 * Who has the turn now and who gets it after, in order: the Active Turn
 * first, then each hand-off. By default it covers one full loop (every
 * eligible member once); pass `length` for more or fewer steps. Empty when
 * there's no Active Turn.
 */
export function rotationHandoffChain<T extends RotationSlot>(
	members: readonly T[],
	currentMemberId: string | null,
	length?: number,
): RotationHandoff<T>[] {
	const active = activeTurn(members, currentMemberId);
	if (!active) return [];
	const steps = length ?? members.filter((m) => m.eligible).length;
	const chain: RotationHandoff<T>[] = [];
	let member = active;
	for (let i = 0; i < steps; i++) {
		if (i === 0) {
			chain.push({ member, loopReset: false });
			continue;
		}
		const next = nextEligibleMember(members, member.memberId);
		if (!next) break;
		member = next.member;
		chain.push({ member, loopReset: next.wrapped });
	}
	return chain;
}

/** What the shared-chore screen shows for a rotation. */
export interface RotationTurns<T> {
	/** The member who completed it last (a skip doesn't change this), or null. */
	doneLast: T | null;
	/** Whose turn it is now, or null if nobody's eligible. */
	activeTurn: T | null;
	/** Who gets the turn after the active member. */
	nextUp: T | null;
	/** Whether handing off from the active member wraps the loop. */
	nextUpIsLoopReset: boolean;
	/** Active Turn first, then one full loop of hand-offs. */
	handoffChain: RotationHandoff<T>[];
	eligibleCount: number;
	/** False when fewer than 2 members are eligible (e.g. someone left). */
	isValid: boolean;
}

/**
 * Done Last / Active Turn / Next Up for a rotation, plus the handoff chain.
 * `currentMemberId` and `lastCompletedMemberId` come from `chore_rotations`.
 */
export function rotationTurns<T extends RotationSlot>(
	members: readonly T[],
	currentMemberId: string | null,
	lastCompletedMemberId: string | null,
): RotationTurns<T> {
	const active = activeTurn(members, currentMemberId);
	const next = active ? nextEligibleMember(members, active.memberId) : null;
	const eligibleCount = members.filter((m) => m.eligible).length;
	return {
		doneLast: members.find((m) => m.memberId === lastCompletedMemberId) ?? null,
		activeTurn: active,
		nextUp: next?.member ?? null,
		nextUpIsLoopReset: next?.wrapped ?? false,
		handoffChain: rotationHandoffChain(members, currentMemberId),
		eligibleCount,
		isValid: eligibleCount >= MIN_ELIGIBLE_ROTATION_MEMBERS,
	};
}

/**
 * The stored current member if they're eligible; otherwise the first eligible
 * member (what the database would hand the turn to).
 */
function activeTurn<T extends RotationSlot>(
	members: readonly T[],
	currentMemberId: string | null,
): T | null {
	const current = members.find(
		(m) => m.memberId === currentMemberId && m.eligible,
	);
	return current ?? nextEligibleMember(members, null)?.member ?? null;
}

/** A rotation member as a parent edits it, before it's saved. */
export interface RotationMemberInput extends RotationSlot {
	exclusionReason?: string | null;
}

export type RotationIssue =
	| { code: 'too_few_eligible'; eligibleCount: number }
	| { code: 'duplicate_member'; memberId: string }
	| { code: 'duplicate_position'; position: number }
	| { code: 'invalid_position'; memberId: string }
	| { code: 'missing_exclusion_reason'; memberId: string }
	| { code: 'exclusion_reason_too_long'; memberId: string }
	| { code: 'unexpected_exclusion_reason'; memberId: string }
	| { code: 'current_not_eligible'; memberId: string | null };

/**
 * Checks a rotation before saving it, with the same rules the database
 * enforces at commit (and the column checks on `chore_rotation_members`), so
 * a form can show them. Returns no issues when it's valid.
 *
 * Pass `currentMemberId` to also check that the turn is on an eligible member.
 */
export function validateRotation(
	members: readonly RotationMemberInput[],
	currentMemberId?: string | null,
): RotationIssue[] {
	const issues: RotationIssue[] = [];
	const seenMembers = new Set<string>();
	const seenPositions = new Set<number>();
	for (const m of members) {
		if (seenMembers.has(m.memberId)) {
			issues.push({ code: 'duplicate_member', memberId: m.memberId });
		}
		seenMembers.add(m.memberId);
		if (!Number.isInteger(m.position) || m.position < 1) {
			issues.push({ code: 'invalid_position', memberId: m.memberId });
		} else if (seenPositions.has(m.position)) {
			issues.push({ code: 'duplicate_position', position: m.position });
		}
		seenPositions.add(m.position);
		const reason = m.exclusionReason?.trim() ?? '';
		if (!m.eligible && reason === '') {
			issues.push({ code: 'missing_exclusion_reason', memberId: m.memberId });
		}
		if (!m.eligible && reason.length > MAX_EXCLUSION_REASON_LENGTH) {
			issues.push({ code: 'exclusion_reason_too_long', memberId: m.memberId });
		}
		if (m.eligible && m.exclusionReason != null) {
			issues.push({
				code: 'unexpected_exclusion_reason',
				memberId: m.memberId,
			});
		}
	}
	const eligibleCount = members.filter((m) => m.eligible).length;
	if (eligibleCount < MIN_ELIGIBLE_ROTATION_MEMBERS) {
		issues.push({ code: 'too_few_eligible', eligibleCount });
	}
	if (
		currentMemberId !== undefined &&
		!members.some((m) => m.memberId === currentMemberId && m.eligible)
	) {
		issues.push({ code: 'current_not_eligible', memberId: currentMemberId });
	}
	return issues;
}
