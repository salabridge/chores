import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * A member's role in a household, as one privilege ladder:
 *
 * - `owner`: a parent who also manages the other parents (adds, promotes,
 *   removes them; invites parents) and can rename or delete the household.
 *   Whoever creates a household becomes its owner.
 * - `parent`: manages kids (creates managed kid profiles, invites kids, edits
 *   and removes kid profiles), manages chores, and has a PIN for the kid
 *   profile lock (SB-51).
 * - `kid`: can see the household but can't run parent-only mutations.
 *
 * We extended the enum rather than adding an `is_parent` flag next to
 * `owner | member`: a flag would allow nonsense combinations (an owner who
 * is a kid), would need a CHECK to rule them out, and would give every check
 * and every invite two fields to read. A single ladder means "is a parent" is
 * just `role in ('owner', 'parent')` (see `app.is_household_parent`), and an
 * invite carries one `role`. The old `member` value became `kid`, the least
 * privileged choice; an owner can promote anyone who should be a parent.
 */
export const householdRole = pgEnum('household_role', [
	'owner',
	'parent',
	'kid',
]);

/** Roles that count as a parent for parent-only routes and mutations. */
export const parentRoles = ['owner', 'parent'] as const;
