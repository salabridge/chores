import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * How a chore is assigned:
 *
 * - `personal`: always the same member (`chores.assigned_member_id`). Often a
 *   multi-step routine ("Stage 2 of 3"), using `chore_stages`.
 * - `rotation`: takes turns between members. Whose turn it is for a period is
 *   recorded on that period's `chore_instances.assigned_member_id`; the
 *   rotation order and turn advancement are SB-25. Rotation chores can have
 *   stages too.
 */
export const choreType = pgEnum('chore_type', ['personal', 'rotation']);

export type ChoreType = (typeof choreType.enumValues)[number];
