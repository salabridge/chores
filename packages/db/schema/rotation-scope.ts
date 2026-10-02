import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Who a rotation chore's loop is drawn from (SB-25):
 *
 * - `whole_household`: everyone in the household takes turns. Members who
 *   can't do it are still listed in `chore_rotation_members`, marked
 *   ineligible with a reason ("Too young for hot-water handling").
 * - `eligible_subset`: only the chosen members take turns ("Kids only").
 *   `chore_rotations.scope_label` names the subset for the UI.
 *
 * The scope describes the rotation for the UI; the database doesn't add or
 * remove members when the household changes. The app decides whether a new
 * household member joins a `whole_household` loop.
 */
export const rotationScope = pgEnum('rotation_scope', [
	'whole_household',
	'eligible_subset',
]);

export type RotationScope = (typeof rotationScope.enumValues)[number];
