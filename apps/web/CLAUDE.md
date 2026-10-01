# CLAUDE.md — apps/web

Guidance for working in `apps/web` (`@chore/web`). See the root [CLAUDE.md](../../CLAUDE.md)
for repo-wide commands, environment variables, and the worktree layout.

## Components

Shared components live in `src/lib/components/`, grouped by area (`ui/`, `auth/`,
`shell/`). Every component there should ship with, side by side:

- `Name.svelte` — the component.
- `Name.svelte.spec.ts` — browser tests (Vitest `client` project).
- `Name.stories.svelte` — **a Storybook entry.** Add one whenever you create a component,
  and update it when you add or change props, variants, or states.

### Storybook

- `pnpm --filter @chore/web storybook` — dev server on <http://localhost:6006>.
- `pnpm --filter @chore/web build-storybook` — static build into `storybook-static/`
  (gitignored).

Both need `packages/tokens/dist`, so build `@chores/tokens` first in a fresh worktree.

CI publishes this Storybook to Chromatic on every PR that touches `apps/web` or
`packages/tokens` (`.github/workflows/chromatic.yml`; see the root README's CI section).
The PR gets a Storybook link and UI Tests / UI Review checks. Visual diffs don't fail CI;
accept or deny them in Chromatic's UI Review. Since every story is a snapshot, a story
that renders nondeterministic output, such as the current date or random data, shows up
as a change on every build. Pass fixed values through `args` instead.
Config is in [.storybook/](.storybook/): `preview.ts` imports `src/routes/layout.css`
(Tailwind, tokens, fonts) and adds a **Theme** toolbar that sets `data-theme` on `<html>`,
so check stories in both light and dark.

Stories use [Svelte CSF](https://github.com/storybookjs/addon-svelte-csf) (`defineMeta`
in a `<script module>`). Follow the existing stories:

- Title by folder: `UI/Badge`, `Auth/CodeInput`, `Shell/BottomNav`.
- Add `tags: ['autodocs']` and put the defaults in `args`. Give union props a
  `select`/`inline-radio` control in `argTypes`.
- Write one story per meaningful variant or state (tones, sizes, disabled, pending,
  with/without optional slots). An `asChild` "All tones"-style overview story helps
  when there are many variants.
- Text children go straight inside `<Story>`. For other snippet props (`icon`, `badge`,
  …), declare a top-level `{#snippet}` and pass it through `args`. For composed
  markup, use `{#snippet template(args)}`. When the component *requires* `children`,
  destructure it out first (`template({ children: _children, ...args })`), or
  svelte-check flags the duplicate prop.
- Use `fn()` from `storybook/test` for callback args (`onclick`, `onclaim`, …) so they
  show in the Actions panel.
- Components that render list items (e.g. `StageStep`'s `<li>`) need a `<ul>` wrapper.
  Full-width shell pieces use `parameters: { layout: 'fullscreen' }`.
- Don't link to real routes from stories. Use `#` hrefs.
