import type { RewardKind } from '../schema/reward-kind.ts';

// Pure rules for the rewards catalog (SB-27): what state a reward is in for a
// member, how far the household is toward a family milestone, and why a claim
// is refused. No database access, so the web app, the tests and the future
// Rewards Shop (SB-43) can all share it. Writing a claim is `claimReward()` in
// the web app's server code.

/** The parts of a `rewards` row the rules need. */
export interface RewardRules {
	id: string;
	kind: RewardKind;
	costPoints: number;
	repeatable: boolean;
}

/**
 * - `earned`: affordable now (personal), or the household reached the target
 *   (family milestone).
 * - `claimed`: a non-repeatable personal reward the member already claimed.
 * - `next_up`: the closest family milestone the household hasn't reached.
 * - `locked`: everything else (not enough points yet, or a milestone further out).
 */
export type RewardStatus = 'earned' | 'claimed' | 'next_up' | 'locked';

export interface RewardStatusContext {
	/** The member's points: the sum of their ledger rows. */
	balance: number;
	/** Points the household earned this week (see `householdWeekProgress`). */
	householdPoints: number;
	/** Rewards this member has at least one claim on. */
	claimedRewardIds: ReadonlySet<string>;
}

/**
 * The status of each reward for one member, keyed by reward id.
 *
 * A repeatable reward is never `claimed`: it goes back to `earned` or `locked`
 * by the balance. Family milestones are never claimed either; the unmet one
 * with the lowest target is `next_up` (the first in the list on a tie).
 */
export function rewardStatuses(
	rewards: readonly RewardRules[],
	{ balance, householdPoints, claimedRewardIds }: RewardStatusContext,
): Map<string, RewardStatus> {
	const statuses = new Map<string, RewardStatus>();
	let nextUp: RewardRules | undefined;
	for (const reward of rewards) {
		if (reward.kind === 'family_milestone') {
			if (householdPoints >= reward.costPoints) {
				statuses.set(reward.id, 'earned');
			} else {
				statuses.set(reward.id, 'locked');
				if (!nextUp || reward.costPoints < nextUp.costPoints) nextUp = reward;
			}
		} else if (!reward.repeatable && claimedRewardIds.has(reward.id)) {
			statuses.set(reward.id, 'claimed');
		} else {
			statuses.set(
				reward.id,
				balance >= reward.costPoints ? 'earned' : 'locked',
			);
		}
	}
	if (nextUp) statuses.set(nextUp.id, 'next_up');
	return statuses;
}

export interface MilestoneProgress {
	id: string;
	/** The household weekly total that unlocks it. */
	target: number;
	/** Points so far, capped at the target. */
	current: number;
	/** `target - current`, never below 0. */
	remaining: number;
	/** Whole percent reached, capped at 100. */
	percent: number;
	reached: boolean;
	/** True for the closest milestone that isn't reached yet. */
	nextUp: boolean;
}

/**
 * Household progress toward each family milestone, lowest target first. Only
 * the first unreached one is `nextUp`. Percent rounds down, so 100 means the
 * milestone is reached.
 */
export function milestoneProgress(
	milestones: readonly Pick<RewardRules, 'id' | 'costPoints'>[],
	householdPoints: number,
): MilestoneProgress[] {
	const points = Math.max(0, householdPoints);
	let nextUpTaken = false;
	return milestones
		.toSorted((a, b) => a.costPoints - b.costPoints)
		.map((m) => {
			const reached = points >= m.costPoints;
			const nextUp = !reached && !nextUpTaken;
			if (nextUp) nextUpTaken = true;
			return {
				id: m.id,
				target: m.costPoints,
				current: Math.min(points, m.costPoints),
				remaining: Math.max(0, m.costPoints - points),
				percent: Math.min(100, Math.floor((points / m.costPoints) * 100)),
				reached,
				nextUp,
			};
		});
}

export type ClaimDenial =
	| 'not_found'
	| 'not_claimable'
	| 'already_claimed'
	| 'insufficient_points';

/**
 * Why a member can't claim a reward right now, or `null` if they can. The
 * database enforces the same rules when the claim is written; this names the
 * reason so the caller can word it.
 */
export function claimDenial(
	reward: RewardRules | null | undefined,
	{ balance, alreadyClaimed }: { balance: number; alreadyClaimed: boolean },
): ClaimDenial | null {
	if (!reward) return 'not_found';
	if (reward.kind !== 'personal') return 'not_claimable';
	if (alreadyClaimed && !reward.repeatable) return 'already_claimed';
	if (balance < reward.costPoints) return 'insufficient_points';
	return null;
}
