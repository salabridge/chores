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
accept or deny them in Chromatic's UI Review.

Chromatic only snapshots one story per stories file: its **Visual test** story, in light
and dark. It renders every other story in the file on one canvas through `VisualTestGrid`
([src/lib/visual-test/](src/lib/visual-test/)), so adding a story to a file adds it to that
file's snapshot. Every other story has `chromatic.disableSnapshot` set in `preview.ts`;
don't turn it back on per story. A story that renders nondeterministic output, such as the
current date or random data, makes its file's snapshot change on every build. Pass fixed
values through `args` instead. Animations are frozen and modal dialogs open in place in the
grid, so a story that relies on either still renders, just statically.

Config is in [.storybook/](.storybook/): `preview.ts` imports `src/routes/layout.css`
(Tailwind, tokens, fonts) and adds a **Theme** toolbar that sets `data-theme` on `<html>`,
so check stories in both light and dark.

Remote function files (`*.remote.ts`) import server code, which can't load in Storybook.
`main.ts` aliases each one a component imports to a stand-in in
[.storybook/mocks/](.storybook/mocks/) that fakes the `form()` surface (`enhance`,
`fields`, `pending`). When a component starts importing a new remote file, add a mock
and an alias for it.

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
- End every stories file with exactly one `Visual test` story that renders the file's own
  module (`visual-test.test.ts` fails without it):

  ```svelte
  <script module lang="ts">
  	import { VisualTestGrid, visualTestParameters } from '#lib/visual-test/index.js';
  	import * as thisFile from './Name.stories.svelte';
  	// ...
  </script>

  <Story
  	name="Visual test"
  	tags={['visual-test', '!autodocs']}
  	parameters={visualTestParameters}
  >
  	{#snippet template(_args, context)}
  		<VisualTestGrid stories={thisFile} theme={context.globals.theme} />
  	{/snippet}
  </Story>
  ```
