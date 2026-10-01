# Chores

A household chore tracker by Salabridge. People sign up, create or join a
household, and share its list of chores with the other members.

It's early: sign-up, sign-in (password or emailed code), password reset, and
the account page work end to end. The household and chore tables exist in the
database with row-level security, but there's no UI for them yet.

## Stack

- **App:** [SvelteKit](https://svelte.dev/docs/kit) with Svelte 5 runes,
  experimental async and remote functions, Tailwind CSS v4, and a PWA service
  worker.
- **Database:** [Neon](https://neon.com) Postgres, with
  [Drizzle ORM](https://orm.drizzle.team) for the schema and migrations.
- **Auth:** [Neon Auth](https://neon.com/docs/auth/overview), Neon's managed
  [Better Auth](https://www.better-auth.com). The SvelteKit server talks to it
  and keeps the session in first-party cookies, so the browser never calls
  Neon directly.
- **Design tokens:** generated from the Figma file's variables.
- **Tooling:** pnpm workspaces, Turborepo, Biome (the only linter and
  formatter), Vitest and Playwright.

## Layout

| Path              | Package          | What it is                                                   |
| ----------------- | ---------------- | ------------------------------------------------------------ |
| `apps/web`        | `@chore/web`     | The SvelteKit app                                            |
| `packages/db`     | `@chore/db`      | Drizzle schema, migrations, RLS helpers ([README](packages/db/README.md)) |
| `packages/tokens` | `@chores/tokens` | CSS custom properties built from Figma ([README](packages/tokens/README.md)) |

## Getting started

You need Node 24 or newer and pnpm (the version is pinned in `package.json`,
so `corepack enable` will pick it up).

```sh
pnpm install
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
# fill both in (see "Environment variables" below)
pnpm --filter @chore/web dev
```

The app runs at <http://localhost:5173>.

## Environment variables

Secrets live only in `.env` files, which are gitignored. The committed
`.env.example` files are templates with placeholder values. Each workspace
reads its own `.env`: Vite loads `apps/web/.env`, and the `@chore/db` scripts
load `packages/db/.env`.

| Variable                     | Used by                   | What it is                                                             |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`               | `apps/web`, `packages/db` | Postgres connection string as `neondb_owner`. Bypasses RLS.            |
| `DATABASE_AUTHENTICATED_URL` | `packages/db`             | Connection string as `authenticated_backend`. RLS applies.             |
| `NEON_AUTH_URL`              | `apps/web`, `packages/db` | Neon Auth base URL for the branch. Neon's docs call it `NEON_AUTH_BASE_URL`. |
| `FIGMA_API_TOKEN`            | `packages/tokens` build   | Optional. Enterprise-only Figma token; without it the build uses the committed snapshot. |
| `FIGMA_FILE_KEY`             | `packages/tokens` build   | Optional. Defaults to the Chores Figma file.                           |

Every value except the Figma ones is specific to a Neon branch. Keep the
database and auth values in one `.env` pointed at the same branch.

### Getting the values

The Neon project is `salabridge-chores`. It has two branches: `production`
(the default) and `dev`. Use `dev`, or a branch of your own, for local work.

- **`DATABASE_URL`:** in the Neon console, pick the branch, click **Connect**,
  and copy the pooled connection string for `neondb_owner`.
- **`DATABASE_AUTHENTICATED_URL`:** the same string with
  `authenticated_backend` and its password. The role is created without a
  password, so on a new branch set one first, as the owner:
  `ALTER ROLE authenticated_backend WITH PASSWORD '...'`.
- **`NEON_AUTH_URL`:** in the Neon console, open **Auth** for the branch and
  copy the Auth URL. It looks like
  `https://ep-….neonauth.c-4.us-west-2.aws.neon.tech/neondb/auth`.
- **`FIGMA_API_TOKEN`:** not needed. The tokens build reads the committed
  `packages/tokens/figma-variables.json` snapshot. The token only matters on a
  Figma Enterprise plan, where it switches the build to the live REST API. See
  [packages/tokens/README.md](packages/tokens/README.md).

Neon Auth only accepts requests from trusted origins. On `dev`, the
**allow localhost** setting covers local work, and
`https://chores.salabridge.family` is on the trusted-domain list. Add any
other origin, such as a preview URL, to that branch's trusted domains in the
Neon Auth settings.

### Neon Auth keys

When Managed Better Auth was enabled, Neon returned a `pub_client_key` and a
`secret_server_key`. Neon shows the secret key only once, so keep both keys
somewhere private and durable outside the repo, such as a personal password
manager. Never commit them. The app doesn't use either
key right now, because the server talks to Neon Auth through `NEON_AUTH_URL`
alone.

Neon's SDK docs also mention a `NEON_AUTH_COOKIE_SECRET`. That variable
belongs to Neon's Next.js SDK, which we don't use, so we don't need it.

### CI

GitHub Actions reads secrets from GitHub **environments**. The **Migrate**
workflow (`.github/workflows/migrate.yml`) runs by hand against the `dev` or
`production` environment, and each environment holds that branch's
`DATABASE_URL` secret. The PR workflow runs only Biome and needs no secrets.

Turborepo runs in strict env mode, so a task sees only the variables declared
for it in `turbo.json`. If you add a variable, declare it there as well. Use
`env` when the variable changes the build output, and `passThroughEnv` when
it doesn't.

### Deployments and preview branches

We haven't picked a host yet: `apps/web` still uses `adapter-auto`. Once we
do, production gets its secrets from the host's environment settings, using
the `production` branch values.

For previews, create a Neon branch per PR, for example with
[`neondatabase/create-branch-action`](https://github.com/neondatabase/create-branch-action).
Neon Auth branches along with the database, so users, sessions and auth
config come with the branch. No auth migration is needed. Each preview then
needs:

1. That branch's `DATABASE_URL` and `NEON_AUTH_URL`.
2. The preview's origin added to the branch's trusted domains.
3. A password for `authenticated_backend`, if anything in the preview uses
   `DATABASE_AUTHENTICATED_URL`.

## Scripts

Run these from the repo root:

| Command                                | What it does                                    |
| -------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                             | Start every workspace in dev mode               |
| `pnpm build`                           | Build every workspace through Turborepo         |
| `pnpm check` / `pnpm check:fix`        | Biome lint, format, and import sorting          |
| `pnpm --filter @chore/web check`       | Type check the app (`svelte-check`)             |
| `pnpm --filter @chore/web test:unit`   | Vitest (browser and Node projects)              |
| `pnpm --filter @chore/web test:e2e`    | Playwright e2e                                  |
| `pnpm --filter @chore/db db:generate`  | Generate a migration from schema changes        |
| `pnpm --filter @chore/db db:migrate`   | Apply migrations to the branch in `.env`        |
| `pnpm --filter @chore/db test:rls`     | RLS smoke test against the branch in `.env`     |

## Working in this repo

The repo is a bare clone with one git worktree per branch
(`sb-chores-bare/main`, `sb-chores-bare/<ticket>`, …), and it's colocated
with [Jujutsu](https://jj-vcs.github.io/). Run commands inside a worktree,
never in the bare root. Work is tracked in Linear under the Salabridge team,
and branch names follow the Linear issue (`feature/sb-12-…`).
