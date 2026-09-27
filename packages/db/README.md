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

The exports point straight at the `.ts` source; there's no build step. This
works for anything that compiles TypeScript itself (Vite/SvelteKit, `tsx`,
Node 24's type stripping). If a consumer ever needs compiled JS, add a `build`
script that emits to `dist/` and point `exports` there.

## Schema layout

- **`schema/auth-schema.ts`**: tables in the `neon_auth` Postgres schema
  (`user`, `session`, `verification`, etc). **Neon Auth owns these tables.**
  They're defined here only so we can query and join against them with types;
  don't change them to alter the database.
- **`schema/index.ts`**: re-exports the tables *we* own, in the `public`
  schema. Each table lives in its own `*.table.ts` file.
- **`schema/schema.ts`**: the entry point. It re-exports both of the above.
  Consumers and drizzle-kit both read from this file.

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

## Type checking

```sh
pnpm exec tsc -p .
```

`skipLibCheck` is on in `tsconfig.json` because TypeScript 7 reports errors
inside drizzle-orm's own type definitions. You can remove it once drizzle's
typings are compatible.
