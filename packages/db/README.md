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
| `@chore/db/rls`    | `src/authenticated-db.ts`| `createAuthenticatedDb()` (RLS)   |

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
  schema (`households`, `household_members`, `chores`). Each table lives in its
  own `*.table.ts` file. drizzle-kit reads only this file, so it never tries to
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

## Row-level security

Every domain table has RLS enabled, with policies for the `authenticated_backend`
role. Access follows household membership:

| Table               | Read                  | Write                                                           |
| ------------------- | --------------------- | --------------------------------------------------------------- |
| `households`        | members (and creator) | anyone can create one (and becomes owner); owners update/delete |
| `household_members` | members               | owners add/change/remove; anyone can remove themselves          |
| `chores`            | members               | members; `assigned_to` must also be a member of the household   |

Postgres identifies the user from the verified Neon Auth JWT. Roles and
functions that drizzle-kit can't manage are in hand-written migrations:
`0000_rls_prereqs.sql` creates the role and the `app.*` helper functions
(`app.current_user_id()` reads `sub` from `request.jwt.claims`).
`0002_rls_grants_and_triggers.sql` adds grants and the trigger that makes a
household's creator its owner.

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

This runs against the branch in `.env`, so use a dev branch. It signs up two
throwaway users through Neon Auth and marks them verified. It then gets real
JWTs and checks that each policy allows or denies correctly, and that the FKs
into `neon_auth.user` hold. It deletes everything it created when it finishes.

## Type checking

```sh
pnpm exec tsc -p .
```

`skipLibCheck` is on in `tsconfig.json` because TypeScript 7 reports errors
inside drizzle-orm's own type definitions. You can remove it once drizzle's
typings are compatible.
