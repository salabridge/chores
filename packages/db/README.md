# `@chore/db`

This package holds the shared Drizzle ORM schema for the Postgres (Neon)
database. Apps and packages import tables from here instead of defining their
own, so there's a single source of truth for the database shape.

## Usage

Add it as a workspace dependency:

```json
"dependencies": {
  "@chore/db": "workspace:*"
}
```

Then import the tables you need, or the whole schema for a Drizzle client:

```ts
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@chore/db';
import { user } from '@chore/db';

const db = drizzle(process.env.DATABASE_URL!, { schema });
```

### Exports

| Import path        | File                     | Contents                          |
| ------------------ | ------------------------ | --------------------------------- |
| `@chore/db`        | `schema/schema.ts`       | Every table and relation          |
| `@chore/db/schema` | `schema/schema.ts`       | Same as above                     |
| `@chore/db/auth`   | `schema/auth-schema.ts`  | Only the Neon Auth tables         |
| `@chore/db/rls`    | `src/authenticated-db.ts`| `createAuthenticatedDb()` (RLS), member/parent helpers, invite tokens |

The exports point straight at the `.ts` source; there's no build step. This
works for anything that compiles TypeScript itself (Vite/SvelteKit, `tsx`,
Node 24's type stripping). If a consumer ever needs compiled JS, add a `build`
script that emits to `dist/` and point `exports` there.

## Schema layout

- **`schema/auth-schema.ts`**: tables in the `neon_auth` Postgres schema
  (`user`, `session`, `verification`, etc). **Neon Auth owns these tables.**
  They're defined here only so we can query, join, and reference them with
  types; don't change them to alter the database. They must match the live
  schema exactly: ids are `uuid` and column names are camelCase.
- **`schema/index.ts`**: re-exports the tables *we* own, in the `public`
  schema (`households`, `household_members`, `household_member_pins`,
  `household_invites`, `chores`). Each table lives in its own `*.table.ts`
  file; the `household_role` enum is in `household-role.ts`. drizzle-kit reads only this file, so it never tries to
  create the `neon_auth` tables; FKs into them are still generated.
- **`schema/rls.ts`**: the `authenticated_backend` role and SQL helpers the
  RLS policies use.
- **`schema/schema.ts`**: the entry point for consumers. It re-exports both
  `auth-schema.ts` and `index.ts`.

### Adding a table

1. Create `schema/<name>.table.ts` and export the table (and any relations)
   as **named exports**. drizzle-kit only picks up named exports, so a
   default-exported object won't be seen.
2. Re-export it from `schema/index.ts`:
   ```ts
   export * from './<name>.table.ts';
   ```
3. Generate and apply a migration (see below).

Relative imports use the `.ts` extension (`./foo.ts`, not `./foo.js`) so they
resolve under Vite, Node, and drizzle-kit alike.

## Migrations (drizzle-kit)

drizzle-kit reads `DATABASE_URL` from `packages/db/.env`, so create that file
first (it isn't committed). Run commands from this directory:

```sh
pnpm exec drizzle-kit generate   # write SQL migration files from schema changes
pnpm exec drizzle-kit migrate    # apply pending migrations
pnpm exec drizzle-kit push       # sync the schema directly (handy on a dev branch)
pnpm exec drizzle-kit studio     # browse the data
```

`drizzle.config.ts` sets `schemaFilter: ['public']`, so drizzle-kit only
manages the `public` schema and leaves Neon's `neon_auth` tables alone.

## Members and roles

A household member (`household_members`) has its own `id`. Everything that
refers to a member (`chores.assigned_member_id`, and later rotations,
completions, and the ledger) uses that id, never the auth user id.

- **Signed-in members** have a `user_id` (their Neon Auth user), at most one
  row per household. They join by creating the household (owner) or by
  accepting an invite.
- **Managed kids** have `user_id` NULL: a parent created the profile and acts
  for them. Because history hangs off the member id, a managed kid could later
  get a login by setting `user_id` on their existing row (not built yet).

Each member has a `display_name` (separate from the auth user's name), an
optional `avatar_color` and `avatar_initial`, and an optional `birth_year`.

`role` (`household_role`) is one ladder: `owner` > `parent` > `kid`. Owners
and parents are both "parents"; the owner additionally manages the other
parents and the household itself. It's an enum rather than an `is_parent`
flag so that impossible combinations (an owner who's a kid) can't exist and
every check reads one column. See `schema/household-role.ts`.

**Invites** (`household_invites`): a parent inserts a row with the invitee's
email, a role (`kid`, or `parent` if they're an owner), and the SHA-256 of a
random token from `createInviteToken()`; the raw token goes in the link. The
invitee signs up or in, then calls `acceptHouseholdInvite(tx, token)`
(`app.accept_household_invite`), which checks the token, expiry, and that
their verified email matches, then creates their member row. The invite is
the parent's approval; there's no separate approval step.

**PINs** (`household_member_pins`): one hashed PIN per parent membership for
the managed-kid profile lock (SB-51). Only the parent themselves can read or
write their row. Store a password hash (argon2id/scrypt), never the PIN.

## Row-level security

Every domain table has RLS enabled, with policies for the `authenticated_backend`
role. Access follows household membership and role:

| Table                   | Read                  | Write                                                                                   |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `households`            | members (and creator) | anyone can create one (and becomes owner); owners update/delete                         |
| `household_members`     | members               | owners add/change/remove anyone; parents add managed kids and change/remove kids and edit their own profile; anyone can leave |
| `household_member_pins` | the parent themselves | the parent themselves                                                                   |
| `household_invites`     | parents               | parents invite kids, owners invite parents; delete to revoke; accept via `app.accept_household_invite` |
| `chores`                | members               | parents; `assigned_member_id` must be a member of the same household                    |

Column grants stop the app from changing a member row's `id`,
`household_id`, `user_id`, or `joined_at`.

Use these in routes and server code (inside `withAuth`) to check roles up
front; RLS enforces the same rules either way:

```ts
import { isHouseholdParent, requireHouseholdParent, currentMemberId, canActAsMember } from '@chore/db/rls';

await db.withAuth(token, async (tx) => {
	await requireHouseholdParent(tx, householdId); // throws NotHouseholdParentError
	// ...parent-only mutation
});
```

| SQL helper (`app.*`)          | TS helper                | True when / returns                                                  |
| ----------------------------- | ------------------------ | -------------------------------------------------------------------- |
| `is_household_member(h)`      |                          | the user is a member of `h`                                          |
| `is_household_parent(h)`      | `isHouseholdParent`      | the user is an owner or parent in `h`                                |
| `is_household_owner(h)`       |                          | the user is an owner of `h`                                          |
| `current_member_id(h)`        | `currentMemberId`        | the user's member row id in `h`, or NULL                             |
| `can_act_as_member(m)`        | `canActAsMember`         | `m` is the user's own row, or a managed kid in a household they parent |
| `is_member_id_in(h, m)`       |                          | member `m` belongs to `h`                                            |

Postgres identifies the user from the verified Neon Auth JWT. Roles and
functions that drizzle-kit can't manage are in hand-written migrations:
`0000_rls_prereqs.sql` creates the role and the `app.*` helper functions
(`app.current_user_id()` reads `sub` from `request.jwt.claims`).
`0002_rls_grants_and_triggers.sql` adds grants and the trigger that makes a
household's creator its owner. `0003_member_rls_helpers.sql` adds the
member/parent helpers, and `0005_rls_grants_invites_triggers.sql` adds the
column grants and `app.accept_household_invite`. `0004` is generated by
drizzle-kit but hand-ordered so existing data migrates (`member` becomes
`kid`; `chores.assigned_to` user ids become `assigned_member_id` member ids).

**Two connection strings** (see `.env.example`):

- `DATABASE_URL` uses `neondb_owner`, which has `BYPASSRLS`. Use it only for
  migrations and admin work.
- `DATABASE_AUTHENTICATED_URL` uses `authenticated_backend`, so RLS applies. Use
  it for everything a user does. The role is created without a password; on a
  new branch, set one with the owner connection
  (`ALTER ROLE authenticated_backend WITH PASSWORD '...'`) and put it in `.env`.
  Never commit it.

Query as a user with `withAuth`. It verifies the JWT against Neon Auth's JWKS,
then runs your callback in a transaction with the claims set:

```ts
import { createAuthenticatedDb } from '@chore/db/rls';
import { chores } from '@chore/db';

const db = createAuthenticatedDb({
	connectionString: process.env.DATABASE_AUTHENTICATED_URL!,
	authUrl: process.env.NEON_AUTH_URL!,
});

// token: from authClient.token() or the set-auth-jwt header
const mine = await db.withAuth(token, (tx) => tx.select().from(chores));
```

With no claims set, `app.current_user_id()` is NULL, so every policy denies
access.

### Smoke test

```sh
pnpm run test:rls
```

This runs against the branch in `.env`, so use a dev branch. It signs up three
throwaway users through Neon Auth and marks them verified. It then gets real
JWTs and checks that each policy allows or denies correctly: an owner, a
parent and a kid who join by invite, a managed kid, PINs, and that every
parent-only mutation fails when the kid runs it. It also checks the FKs and
the one-row-per-user constraint. It deletes everything it created when it
finishes.

## Unit tests

```sh
pnpm run test:unit
```

## Type checking

```sh
pnpm exec tsc -p .
```

`skipLibCheck` is on in `tsconfig.json` because TypeScript 7 reports errors
inside drizzle-orm's own type definitions. You can remove it once drizzle's
typings are compatible.
