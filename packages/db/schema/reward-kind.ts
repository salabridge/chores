import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * What kind of reward a `rewards` row is (SB-27):
 *
 * - `personal`: one member spends their own points on it ("30 Min Screen
 *   Time"). Claiming writes a negative `points_ledger` row.
 * - `family_milestone`: unlocks for everyone when the household's points this
 *   week reach its cost ("Sundaes on Sunday"). Nobody spends points on it, so
 *   it is never claimed and never repeatable.
 */
export const rewardKind = pgEnum('reward_kind', [
	'personal',
	'family_milestone',
]);

export type RewardKind = (typeof rewardKind.enumValues)[number];
