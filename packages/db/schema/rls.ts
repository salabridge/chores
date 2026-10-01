import { type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn, pgRole } from 'drizzle-orm/pg-core';

/**
 * Login role the app uses for user-facing queries. It has no BYPASSRLS, so
 * every policy below applies to it. Created (and granted table access) by the
 * custom migrations in ../migrations, not by drizzle-kit.
 */
export const backendRole = pgRole('authenticated_backend').existing();

// The SQL functions below live in the `app` schema and are created by the
// custom migrations. They read the verified JWT claims that
// `withAuth()` (see ../src/authenticated-db.ts) puts in `request.jwt.claims`,
// and resolve the signed-in user to their `household_members` row.

/** The signed-in user's id (the JWT `sub`), or NULL when there's no session. */
export const currentUserId = sql`(select app.current_user_id())`;

/** True when the signed-in user belongs to the household in `column`. */
export const isHouseholdMember = (column: AnyPgColumn): SQL =>
	sql`app.is_household_member(${column})`;

/** True when the signed-in user is a parent (role `parent` or `owner`) in the household. */
export const isHouseholdParent = (column: AnyPgColumn): SQL =>
	sql`app.is_household_parent(${column})`;

/** True when the signed-in user is an owner of the household in `column`. */
export const isHouseholdOwner = (column: AnyPgColumn): SQL =>
	sql`app.is_household_owner(${column})`;

/**
 * True when `member` is NULL or is the id of a `household_members` row in
 * `household`. Used to keep member references inside their household.
 */
export const isMemberIdInHousehold = (
	household: AnyPgColumn,
	member: AnyPgColumn,
): SQL =>
	sql`(${member} is null or app.is_member_id_in(${household}, ${member}))`;

/** True when the member row `member` belongs to the signed-in user. */
export const isOwnMember = (member: AnyPgColumn): SQL =>
	sql`app.is_own_member(${member})`;
