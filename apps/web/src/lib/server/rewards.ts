import {
	choreCompletions,
	chores,
	pointsLedger,
	rewardClaims,
	rewards,
} from '@chore/db';
import { chorePeriodStart, localDate } from '@chore/db/recurrence';
import {
	type ClaimDenial,
	claimDenial,
	milestoneProgress,
	rewardStatuses,
} from '@chore/db/rewards';
import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';
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

/** The household's rewards, cheapest first. */
export function listRewards(householdId: string) {
	return db
		.select(rewardColumns)
		.from(rewards)
		.where(eq(rewards.householdId, householdId))
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
		.where(and(eq(rewards.id, id), eq(rewards.householdId, householdId)))
		.returning({ id: rewards.id });
	if (updated.length === 0) throw new RewardError('That reward was not found.');
}

/** Deleting a reward also deletes its claims; the points they spent stay in the ledger. */
export async function deleteReward(
	householdId: string,
	id: string,
): Promise<void> {
	const deleted = await db
		.delete(rewards)
		.where(and(eq(rewards.id, id), eq(rewards.householdId, householdId)))
		.returning({ id: rewards.id });
	if (deleted.length === 0) throw new RewardError('That reward was not found.');
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
 * What the household has done since Monday: points earned (completions net of
 * reversals, not claims or adjustments, same as a member's weekly goal) and
 * how many rotation chores ("loops") were completed.
 */
export async function householdWeekProgress(
	householdId: string,
	now: Date = new Date(),
): Promise<{ points: number; loopsCompleted: number }> {
	const since = weekStart(now);
	const [[pointsRow], [loopsRow]] = await Promise.all([
		db
			.select({
				total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`,
			})
			.from(pointsLedger)
			.where(
				and(
					eq(pointsLedger.householdId, householdId),
					gte(pointsLedger.createdAt, since),
					sql`${pointsLedger.reason} in ('completion', 'reversal')`,
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
					gte(choreCompletions.completedAt, since),
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
 * claim. Refused (`RewardError`) when the reward is unknown, a family
 * milestone, unaffordable, or non-repeatable and already claimed by this
 * member.
 *
 * The claim and its negative ledger row are one SQL statement, so they commit
 * together and the balance and claim-limit checks happen in the same snapshot
 * as the writes. Two taps at once can't both claim a non-repeatable reward (a
 * partial unique index on `reward_claims`). Two claims on *different* rewards
 * at the same moment could, in theory, both see the same balance; each is
 * still checked against it, so the worst case is a slightly negative balance.
 */
export async function claimReward(
	member: { id: string; householdId: string },
	rewardId: string,
): Promise<{ claimId: string }> {
	try {
		const { rows } = await db.execute<{ id: string }>(sql`
			with r as (
				select id, household_id, cost_points, repeatable
				from rewards
				where id = ${rewardId} and household_id = ${member.householdId} and kind = 'personal'
			),
			bal as (
				select coalesce(sum(delta), 0)::int as balance
				from points_ledger
				where member_id = ${member.id}
			),
			claim as (
				insert into reward_claims (household_id, reward_id, member_id, cost_points, single_use)
				select r.household_id, r.id, ${member.id}, r.cost_points, not r.repeatable
				from r, bal
				where bal.balance >= r.cost_points
					and (r.repeatable or not exists (
						select 1 from reward_claims c where c.reward_id = r.id and c.member_id = ${member.id}
					))
				returning id, household_id, member_id, cost_points
			),
			spend as (
				insert into points_ledger (household_id, member_id, delta, reason, reward_claim_id)
				select household_id, member_id, -cost_points, 'reward_claim', id from claim
			)
			select id from claim
		`);
		if (rows[0]) return { claimId: rows[0].id };
	} catch (e) {
		if (!isUniqueViolation(e)) throw e;
		throw denied('already_claimed');
	}

	// Nothing was written: work out why, for the message.
	const [reward] = await db
		.select(rewardColumns)
		.from(rewards)
		.where(
			and(
				eq(rewards.id, rewardId),
				eq(rewards.householdId, member.householdId),
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

/** A unique-index violation (SQLSTATE 23505), on the error or what it wraps. */
function isUniqueViolation(err: unknown): boolean {
	let e: unknown = err;
	while (e instanceof Error) {
		if ((e as { code?: unknown }).code === '23505') return true;
		e = e.cause;
	}
	return false;
}
