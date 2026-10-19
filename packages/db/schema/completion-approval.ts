import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Where a `chore_completions` row stands on approval (SB-79):
 *
 * - `approved`: it counts. The chore is done for the period, the points are
 *   in the ledger and a rotation turn has moved on. Every completion by the
 *   assignee (or recorded by a parent) is approved straight away.
 * - `pending`: a favour waiting for a decision. Mia says she did Leo's chore;
 *   no points yet and the turn hasn't moved, but it still blocks anyone else
 *   completing that instance. Leo (or a parent) decides.
 * - `declined`: Leo (or a parent) said it wasn't done. No points, and the
 *   instance is open again. Mia can ask a parent if Leo declined it.
 */
export const completionApprovalStatus = pgEnum('completion_approval_status', [
	'approved',
	'pending',
	'declined',
]);

export type CompletionApprovalStatus =
	(typeof completionApprovalStatus.enumValues)[number];
