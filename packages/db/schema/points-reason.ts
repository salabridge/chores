import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Why a `points_ledger` row exists (SB-26):
 *
 * - `completion`: points awarded for finishing a chore (positive).
 * - `reversal`: a parent reopened that completion, so its points are taken
 *   back (negative, the same amount). The original row stays: the ledger is
 *   append-only.
 * - `reward_claim`: points spent on a reward (negative; written by SB-27).
 * - `adjustment`: a parent's manual correction (either sign).
 */
export const pointsReason = pgEnum('points_reason', [
	'completion',
	'reversal',
	'reward_claim',
	'adjustment',
]);

export type PointsReason = (typeof pointsReason.enumValues)[number];
