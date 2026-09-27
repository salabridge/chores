# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`packageManager` pinned in root `package.json`). Run from
this worktree root (`main/`):

- `pnpm install` — install all workspace dependencies.
- `pnpm run build` — build all apps/packages via Turborepo (`turbo run build`).
- `pnpm run dev` — run all apps/packages in dev mode (persistent, uncached).
- `pnpm run check` / `pnpm run check:fix` — Biome lint + format + import sorting over
  the whole repo (report only / apply fixes).
- `pnpm run lint` / `pnpm run lint:fix` — Biome lint only.
- `pnpm run format` — Biome format with `--write`.
- `pnpm run check-types` — runs `turbo run check-types`, but no workspace defines that
  script (`apps/web` uses `check`/`svelte-check` instead — see below), so this is
  currently a no-op.

**Biome is the only linter/formatter** (no ESLint or Prettier). It's configured once in
the root [biome.json](biome.json) and run from the root rather than per-workspace through
Turborepo, so don't add `lint`/`format` scripts to individual packages. It respects
`.gitignore` files (including nested ones like `apps/web/.gitignore`).

There is no root-level `test` script yet, even though `apps/web` has real test scripts.
To scope a command to a single workspace, use Turborepo's filter flag or pnpm's, e.g.:

- `turbo run build --filter=web`
- `pnpm --filter web check` — typecheck `apps/web` (`svelte-kit sync && svelte-check`).
- `pnpm --filter web test` — run `apps/web`'s vitest (unit + browser) suite, then its
  Playwright e2e suite (`test:unit` then `test:e2e`).

`packages/tokens` fetches live from the Figma REST API on every build, so its
`build` script requires a `FIGMA_API_TOKEN` env var (Enterprise-org personal
access token with `file_variables:read`) — see
[packages/tokens/README.md](packages/tokens/README.md).

## Architecture

This is a **Turborepo monorepo** (root scaffolded via `create-turbo`), with task
orchestration/caching defined in [turbo.json](turbo.json) and workspaces declared in
[pnpm-workspace.yaml](pnpm-workspace.yaml) (`apps/*` and `packages/*`):

- `apps/web` (`web`) — SvelteKit app (Svelte 5, runes forced project-wide via
  `compilerOptions.runes` in [vite.config.ts](apps/web/vite.config.ts)), built with Vite,
  Tailwind CSS v4, `adapter-auto`, and SvelteKit's experimental `async`/`remoteFunctions`
  flags enabled. Testing is already wired up: Vitest with two projects (`client` — browser
  tests via `@vitest/browser-playwright` for `*.svelte.{test,spec}.ts`; `server` — plain
  Node tests for everything else) plus a separate Playwright e2e suite under
  `src/routes/demo/playwright`.
- `packages/tokens` (`@chores/tokens`) — CSS custom properties generated at build time from
  the Figma file's variables (colors with light/dark modes, raw-value spacing). See
  [packages/tokens/README.md](packages/tokens/README.md).

Turborepo's `build` task depends on upstream packages' `build` tasks first
(`dependsOn: ["^build"]`). `dev` is uncached and persistent (long-running dev servers).
Build outputs are cached per-task based on the `inputs`/`outputs` globs in
[turbo.json](turbo.json) — note `build` currently has no `outputs` glob configured, so
nothing is actually cached across runs yet.

`apps/web` is still an unmodified SvelteKit starter (the default routes/demo content from
the SvelteKit CLI) — none of this reflects actual chores-app functionality yet. The root
[README.md](README.md) also still describes the original `create-turbo` Next.js starter
layout (docs/web/ui/eslint-config/typescript-config) and hasn't been updated to match.

## Repository layout

This is a **bare repo + worktree** setup, not a standard checkout:

- `sb-chores-bare/` — the bare `.git` directory (repo root, `core.bare = true`).
- `sb-chores-bare/main/` — a worktree checked out for the `main` branch. This is where
  you should be working; commands should be run from here, not from the bare root.
- The repo is also colocated with [Jujutsu (`jj`)](https://jj-vcs.github.io/) — `jj log` /
  `jj st` work alongside plain `git` commands in this worktree.

See the `bare-repo-workflow` skill for how to create/switch/remove worktrees in this
layout, and `prune-worktrees` for cleaning up worktrees whose branch has already merged.

## Remote

- `origin` → `git@github.com:salabridge/chores.git` (no commits pushed yet — this
  Turborepo scaffold has not been committed).
