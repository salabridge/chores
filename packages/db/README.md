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
| `@chore/db/recurrence` | `src/recurrence.ts`  | `chorePeriodStart()` and other period math for recurring chores |

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
  `household_invites`, `chores`, `chore_stages`, `chore_instances`,
  `chore_stage_progress`). Each table lives in its own `*.table.ts` file; the
  enums are in `household-role.ts`, `chore-type.ts`, and
  `chore-frequency.ts`. drizzle-kit reads only this file, so it never tries to
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

## Chores

A chore (`chores`) is a definition: what to do, for how many points, and how
often. It has no per-day state; that lives on its instances (see
**Recurrence** below).

- `type` (`chore_type`): `personal` (always `assigned_member_id`) or
  `rotation` (members take turns; the rotation itself is SB-25).
- `points`: the reward. The creator offers 5/10/15/20 as presets, but any
  integer `>= 0` is stored. Defaults to 10.
- `frequency` (`chore_frequency`): `daily`, `weekly`, or `weekends`.
- `due_time` (optional, `time`, household-local, e.g. `20:00` for "by 8:00
  PM") and `due_label` (optional free text, e.g. "after dinner"). The UI shows
  the label if there is one, otherwise the time.
- `description` is the **Parent Note** in the UI. It keeps its column name.
- `due_at` and `completed_at` are legacy one-off fields from before
  recurrence. Nothing uses them; SB-26 should drop them.

**Stages** (`chore_stages`): an ordered list of steps (`position` from 1,
unique per chore, `title`, optional `hint`, and `points` on top of the
chore's). Both personal and rotation chores can have them; "Stage 2 of 3" is
the stage's rank by `position` among the chore's stages.

**Stage progress** (`chore_stage_progress`): one row per stage done in an
instance, recording who did it and when. Unchecking a stage deletes its row.

`chore_stages`, `chore_instances`, and `chore_stage_progress` carry
`household_id` (and `chore_id`) alongside their parent ids, tied together by
composite foreign keys, for example `(chore_id, household_id)` references
`chores (id, household_id)`. That keeps every policy a plain
`app.is_household_member(household_id)` check like `chores`, and stops a stage
from one chore being checked off on another chore's instance.

### Recurrence

**Decision: one `chore_instances` row per chore per period, created lazily.
Nothing is ever reset in place; the next period simply has no row yet.**

A period is a day for `daily` and `weekends` chores (Saturdays and Sundays
only) and an ISO week starting Monday for `weekly` ones. It's identified by
`period_start`, its first local date, from `chorePeriodStart(frequency, date)`
in `src/recurrence.ts`. `(chore_id, period_start)` is unique. The app creates
the row the first time anyone opens or works on the chore in that period:

```ts
import { chorePeriodStart, localDate } from '@chore/db/recurrence';

const periodStart = chorePeriodStart(chore.frequency, localDate(timeZone));
if (periodStart) {
	await tx
		.insert(choreInstances)
		.values({ householdId, choreId: chore.id, periodStart, assignedMemberId })
		.onConflictDoNothing();
}
```

We considered computing everything from completions instead (no instance
table; "done this period" means "a completion exists with a timestamp in this
period"). We chose instance rows because:

- **Stage progress needs a parent.** "Stage 2 of 3" is state about one period.
  With instances it's rows keyed by `(instance_id, stage_id)`, and the reset
  is free: a new period is a new instance with no progress. Without them,
  every stage query would have to re-derive the period from timestamps.
- **Rotations need a snapshot (SB-25).** Whose turn it was is stored on the
  instance (`assigned_member_id`) when the period starts. Editing the
  rotation later doesn't rewrite who was responsible last week, and advancing
  the turn is "the next instance gets the next member".
- **Completions and the ledger have something to point at (SB-26).** A
  completion references an instance, so "done this period" is a key lookup,
  and a unique constraint can stop the same period from paying out twice.
- **Time zones are settled once.** `period_start` is a local `date`, not an
  instant, so a chore done at 11:30 PM doesn't land in tomorrow because the
  server is in UTC. The caller picks the zone (`localDate(timeZone)`);
  households don't store one yet, so for now that's the user's zone.

Rows are lazy rather than pre-generated by a scheduled job, so there's no
cron and no rows for chores nobody looked at. The cost is that **a missed
period has no row**. Streaks (SB-28) walk back period by period
(`previousPeriodStart()`) from today and stop at the first period with no
completed instance, missing rows included. Periods before the chore's
`created_at` don't count.

Downstream notes:

- **SB-25 (rotations):** set `assigned_member_id` when creating the instance
  from the rotation order, and advance based on the previous instance. Any
  member can create an instance today (the first person to open the chore);
  if kids shouldn't be able to choose the assignee, move creation into a
  `SECURITY DEFINER` function that computes it.
- **SB-26 (completions, points ledger):** reference `chore_instances.id` and
  award `chores.points` plus `chore_stages.points` from the progress rows.
  Copy the point values into the ledger at award time, since parents can edit
  a chore's points later.
- **SB-28 (streaks):** a streak is consecutive periods whose instance is
  complete, per `chorePeriodStart`/`previousPeriodStart`. `weekends` chores
  skip weekdays rather than breaking on them.

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
| `chore_stages`          | members               | parents                                                                                 |
| `chore_instances`       | members               | any member can start a period (insert); parents update/delete                           |
| `chore_stage_progress`  | members               | members check off stages as themselves; parents for anyone in the household; uncheck (delete) the same way |

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
`0006_chore_types_points_frequency_stages.sql` (SB-24) is generated, with the
`chores (id, household_id)` unique constraint moved before the composite FKs
that need it and explicit grants added at the end. Existing chores become
personal, daily, 10-point chores.

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

This runs against the branch in `.env`, so use a dev branch. It signs up four
throwaway users through Neon Auth and marks them verified. It then gets real
JWTs and checks that each policy allows or denies correctly: an owner, a
parent and a kid who join by invite, a managed kid, PINs, and that every
parent-only mutation fails when the kid runs it. For chores it covers stages
(parents only), starting a period's instance (once per period), checking off
stages as yourself or for a managed kid, the next period starting empty, and
that a non-member sees none of it. It also checks the FKs and
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
