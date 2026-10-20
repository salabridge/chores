import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * What kind of `adjustment` a `points_ledger` row is (SB-83). NULL on every
 * other reason, and on a parent's plain correction.
 *
 * - `gift`: bonus points a parent gave a kid (SB-78). The only kind the kid's
 *   Rewards screen lists and the "You got bonus points!" moment shows.
 * - `carry_over`: a moved member's balance when a household merges into
 *   another on invite accept (SB-76, "Carried over from …").
 * - `transfer`: a member's balance moved when they're removed from a
 *   household (SB-84, "Moved from …").
 *
 * Before this column, gifts were told apart from carry-overs by the note's
 * prefix; migration 0025 backfilled it from that.
 */
export const pointsAdjustmentKind = pgEnum('points_adjustment_kind', [
	'gift',
	'carry_over',
	'transfer',
]);

export type PointsAdjustmentKind =
	(typeof pointsAdjustmentKind.enumValues)[number];
