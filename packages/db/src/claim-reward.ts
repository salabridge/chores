import { type SQL, sql } from 'drizzle-orm';
import type { ClaimDenial } from './rewards.ts';

// The claim statement for personal rewards (SB-27). It runs as the table owner
// (the web app's connection): the RLS role can't write `reward_claims`. The
// web app's `claimReward()` wraps it with the error wording; it lives here so
// `scripts/rls-smoke.ts` can run it against a real database.

/** Anything with Drizzle's `execute`, such as the web app's `db` or a transaction. */
export interface SqlExecutor {
	execute(query: SQL): PromiseLike<{ rows: unknown[] }>;
}

/**
 * Claims a personal reward for a member: one statement inserts the
 * `reward_claims` row and a negative `reward_claim` ledger row (noted with the
 * reward's title), so both commit or neither does. Returns the claim id, or
 * `null` when nothing was written because the reward is missing, archived, a
 * family milestone, unaffordable, or non-repeatable and already claimed.
 *
 * Those checks happen against the statement's snapshot, so on their own they
 * race. The checks that hold under concurrency are in the database and make
 * the statement throw instead (see `claimFailure`): the partial unique index on
 * `reward_claims` (SQLSTATE 23505) and the balance trigger on `points_ledger`
 * (RW001, migration 0012).
 */
export async function insertRewardClaim(
	exec: SqlExecutor,
	member: { id: string; householdId: string },
	rewardId: string,
): Promise<string | null> {
	const { rows } = await exec.execute(sql`
		with r as (
			select id, household_id, title, cost_points, repeatable
			from rewards
			where id = ${rewardId} and household_id = ${member.householdId}
				and kind = 'personal' and archived_at is null
		),
		bal as (
			select coalesce(sum(delta), 0)::int as balance
			from points_ledger
			where member_id = ${member.id}
		),
		claim as (
			insert into reward_claims (household_id, reward_id, member_id, reward_title, cost_points, single_use)
			select r.household_id, r.id, ${member.id}, r.title, r.cost_points, not r.repeatable
			from r, bal
			where bal.balance >= r.cost_points
				and (r.repeatable or not exists (
					select 1 from reward_claims c where c.reward_id = r.id and c.member_id = ${member.id}
				))
			returning id, household_id, member_id, reward_title, cost_points
		),
		spend as (
			insert into points_ledger (household_id, member_id, delta, reason, reward_claim_id, note)
			select household_id, member_id, -cost_points, 'reward_claim', id, reward_title from claim
		)
		select id from claim
	`);
	return (rows[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Maps an error thrown by `insertRewardClaim` to why the claim was refused, or
 * `null` if it is some other failure.
 */
export function claimFailure(err: unknown): ClaimDenial | null {
	let e: unknown = err;
	while (e instanceof Error) {
		const code = (e as { code?: unknown }).code;
		if (code === '23505') return 'already_claimed';
		if (code === 'RW001') return 'insufficient_points';
		e = e.cause;
	}
	return null;
}
