import {
	choreCompletions,
	chores,
	pointsLedger,
	rewardClaims,
	rewards,
} from '@chore/db';
import { claimFailure, insertRewardClaim } from '@chore/db/claim-reward';
import { chorePeriodStart, localDate } from '@chore/db/recurrence';
import {
	type ClaimDenial,
	claimDenial,
	milestoneProgress,
	rewardStatuses,
} from '@chore/db/rewards';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
	claimDenialMessage,
	type RewardInput,
	rewardInputError,
} from '../rewards.ts';
import { db } from './drizzle.ts';

// Reads and writes for the rewards catalog and claims (SB-27). As in
// chores.ts, the web app is the table owner, so RLS doesn't apply: every query
// is scoped by the household of the caller's own profile. Catalog writes must
// be parent-only; claims are for the member the request acts as.

// Households have no time zone yet (see overview.ts), so weeks start on the
// UTC Monday.
const HOUSEHOLD_TIME_ZONE = 'UTC';

/** A problem with what was sent, worded for the form or the claim button. */
export class RewardError extends Error {
	readonly denial: ClaimDenial | null;

	constructor(message: string, denial: ClaimDenial | null = null) {
		super(message);
		this.name = 'RewardError';
		this.denial = denial;
	}
}

const rewardColumns = {
	id: rewards.id,
	title: rewards.title,
	description: rewards.description,
	costPoints: rewards.costPoints,
	kind: rewards.kind,
	repeatable: rewards.repeatable,
};

/** The household's rewards (archived ones left out), cheapest first. */
export function listRewards(householdId: string) {
	return db
		.select(rewardColumns)
		.from(rewards)
		.where(
			and(eq(rewards.householdId, householdId), isNull(rewards.archivedAt)),
		)
		.orderBy(asc(rewards.costPoints), asc(rewards.createdAt), asc(rewards.id));
}

export async function createReward(
	actor: { householdId: string; userId: string | null },
	input: RewardInput,
): Promise<{ id: string }> {
	const problem = rewardInputError(input);
	if (problem) throw new RewardError(problem);
	const [row] = await db
		.insert(rewards)
		.values({
			householdId: actor.householdId,
			title: input.title.trim(),
			description: input.description?.trim() || null,
			costPoints: input.costPoints,
			kind: input.kind,
			repeatable: input.repeatable,
			createdBy: actor.userId,
		})
		.returning({ id: rewards.id });
	if (!row) throw new Error('Insert returned no row');
	return row;
}

export async function updateReward(
	householdId: string,
	id: string,
	input: RewardInput,
): Promise<void> {
	const problem = rewardInputError(input);
	if (problem) throw new RewardError(problem);
	const updated = await db
		.update(rewards)
		.set({
			title: input.title.trim(),
			description: input.description?.trim() || null,
			costPoints: input.costPoints,
			kind: input.kind,
			repeatable: input.repeatable,
		})
		.where(
			and(
				eq(rewards.id, id),
				eq(rewards.householdId, householdId),
				isNull(rewards.archivedAt),
			),
		)
		.returning({ id: rewards.id });
	if (updated.length === 0) throw new RewardError('That reward was not found.');
}

/**
 * Removes a reward from the catalog by archiving it. Claims keep pointing at
 * it, so the record of what was redeemed (and what the kid's spent points were
 * for) survives; it just can't be claimed or edited any more.
 */
export async function archiveReward(
	householdId: string,
	id: string,
): Promise<void> {
	const archived = await db
		.update(rewards)
		.set({ archivedAt: new Date() })
		.where(
			and(
				eq(rewards.id, id),
				eq(rewards.householdId, householdId),
				isNull(rewards.archivedAt),
			),
		)
		.returning({ id: rewards.id });
	if (archived.length === 0)
		throw new RewardError('That reward was not found.');
}

/** The start of this household-local week (Monday) as an instant. */
function weekStart(now: Date): Date {
	const monday = chorePeriodStart(
		'weekly',
		localDate(HOUSEHOLD_TIME_ZONE, now),
	);
	return new Date(`${monday}T00:00:00Z`);
}

/**
 * What the household has done since Monday: points earned and how many
 * rotation chores ("loops") were completed. Both count by when the chore was
 * completed: a reversal belongs to the week of the completion it takes back,
 * so a parent reopening an old completion doesn't lower this week's total.
 * Claims and adjustments don't count (same as a member's weekly goal).
 */
export async function householdWeekProgress(
	householdId: string,
	now: Date = new Date(),
): Promise<{ points: number; loopsCompleted: number }> {
	const since = weekStart(now).toISOString();
	const [[pointsRow], [loopsRow]] = await Promise.all([
		db
			.select({
				total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
			})
			.from(pointsLedger)
			.leftJoin(
				choreCompletions,
				eq(choreCompletions.id, pointsLedger.completionId),
			)
			.where(
				and(
					eq(pointsLedger.householdId, householdId),
					sql`${pointsLedger.reason} in ('completion', 'reversal')`,
					// The completion is gone if its chore was deleted: use the row's own date then.
					sql`coalesce(${choreCompletions.completedAt}, ${pointsLedger.createdAt}) >= ${since}::timestamptz`,
				),
			),
		db
			.select({ total: sql<number>`count(*)::int` })
			.from(choreCompletions)
			.innerJoin(chores, eq(chores.id, choreCompletions.choreId))
			.where(
				and(
					eq(choreCompletions.householdId, householdId),
					isNull(choreCompletions.reopenedAt),
					sql`${choreCompletions.completedAt} >= ${since}::timestamptz`,
					eq(chores.type, 'rotation'),
				),
			),
	]);
	return {
		points: pointsRow?.total ?? 0,
		loopsCompleted: loopsRow?.total ?? 0,
	};
}

/** A member's points: the sum of their ledger rows. */
async function memberBalance(memberId: string): Promise<number> {
	const [row] = await db
		.select({
			total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
		})
		.from(pointsLedger)
		.where(eq(pointsLedger.memberId, memberId));
	return row?.total ?? 0;
}

async function claimedRewardIds(memberId: string): Promise<Set<string>> {
	const rows = await db
		.select({ rewardId: rewardClaims.rewardId })
		.from(rewardClaims)
		.where(eq(rewardClaims.memberId, memberId));
	return new Set(rows.map((r) => r.rewardId));
}

/**
 * Everything the Rewards Shop (SB-43) and the parent page show: each reward
 * with its status for `member`, the member's balance, and the household's
 * progress toward the family milestones.
 */
export async function loadRewardShop(
	member: { id: string; householdId: string },
	now: Date = new Date(),
) {
	const [catalog, balance, claimed, week] = await Promise.all([
		listRewards(member.householdId),
		memberBalance(member.id),
		claimedRewardIds(member.id),
		householdWeekProgress(member.householdId, now),
	]);
	const statuses = rewardStatuses(catalog, {
		balance,
		householdPoints: week.points,
		claimedRewardIds: claimed,
	});
	const progress = milestoneProgress(
		catalog.filter((r) => r.kind === 'family_milestone'),
		week.points,
	);
	return {
		balance,
		week,
		rewards: catalog.map((r) => ({
			...r,
			status: statuses.get(r.id) ?? 'locked',
		})),
		milestones: progress,
	};
}

/**
 * Claims a personal reward for `member`: spends its cost and records the
 * claim. Refused (`RewardError`) when the reward is unknown or archived, a
 * family milestone, unaffordable, or non-repeatable and already claimed by this
 * member.
 *
 * The claim and its negative ledger row are one SQL statement, so they commit
 * together. The statement checks the balance and the claim limit up front, but
 * concurrent statements all see the same committed balance, so the checks that
 * hold under concurrency are in the database: a partial unique index on
 * `reward_claims` stops a non-repeatable reward being claimed twice, and a
 * trigger on `points_ledger` (migration 0012) serializes a member's claims and
 * raises RW001 if one would take the balance below zero. Either way the
 * whole statement rolls back and the caller gets the matching `RewardError`.
 */
export async function claimReward(
	member: { id: string; householdId: string },
	rewardId: string,
): Promise<{ claimId: string }> {
	try {
		const claimId = await insertRewardClaim(db, member, rewardId);
		if (claimId) return { claimId };
	} catch (e) {
		const denial = claimFailure(e);
		if (denial) throw denied(denial);
		throw e;
	}

	// Nothing was written: work out why, for the message.
	const [reward] = await db
		.select(rewardColumns)
		.from(rewards)
		.where(
			and(
				eq(rewards.id, rewardId),
				eq(rewards.householdId, member.householdId),
				isNull(rewards.archivedAt),
			),
		);
	const [balance, claimed] = await Promise.all([
		memberBalance(member.id),
		claimedRewardIds(member.id),
	]);
	throw denied(
		claimDenial(reward, { balance, alreadyClaimed: claimed.has(rewardId) }) ??
			'insufficient_points',
	);
}

function denied(denial: ClaimDenial) {
	return new RewardError(claimDenialMessage(denial), denial);
}
