# `@chores/tokens`

This is the package we use to publish our design tokens from Figma as CSS custom
properties.

Source of truth for the values: the ["Chores" Figma file variables](https://www.figma.com/design/xWedurFoYbsD1iw9WW9wii/Chores?node-id=0-1&view=variables).

## Usage

```css
@import "@chores/tokens";
```

This pulls in `dist/tokens.css`, which defines every token as a `--color-*` or
`--spacing-*` custom property on `:root`.

- **Color tokens** have separate light/dark values. The dark values apply
  automatically under `@media (prefers-color-scheme: dark)`, and can also be
  forced with `[data-theme="dark"]` / `[data-theme="light"]` on `:root` (or
  any ancestor) for a manual theme toggle.
- **Spacing tokens** are a single raw pixel value — no light/dark split.

## Tailwind CSS v4 theme

To register these tokens as Tailwind v4 theme variables (so utilities like
`bg-text-primary` or `p-small` are generated from them), import the
`./tailwind` export instead of (or alongside) the plain CSS:

```css
@import "tailwindcss";
@import "@chores/tokens/tailwind";
```

This pulls in `dist/tailwind.css`, which itself imports `tokens.css` and
re-declares every token inside an `@theme inline` block
(`--color-text-primary: var(--color-text-primary);`, etc). `@theme inline` is
used rather than literal values so the `:root`/`@media (prefers-color-scheme)`/
`[data-theme]` switching defined in `tokens.css` keeps working — Tailwind
resolves the CSS variable at paint time instead of baking in a value at
build time.

## Updating tokens

`pnpm build` regenerates `dist/` from
[`figma-variables.json`](figma-variables.json), a committed snapshot of the
Figma file's variables. It's in the same shape as the `meta` of Figma's [local
variables REST endpoint](https://developers.figma.com/docs/rest-api/variables/).
That endpoint only works on Enterprise plans, so the build doesn't need it or
any secrets. Turborepo hashes the snapshot as a build input, so changing it
rebuilds the tokens.

### Refreshing the snapshot from Figma

After a design change in Figma, re-export the variables through the Figma MCP
server, which works on any plan:

1. Ask Claude Code to run
   [`scripts/export-variables.figma.js`](scripts/export-variables.figma.js)
   with the Figma MCP's `use_figma` tool on file `xWedurFoYbsD1iw9WW9wii`.
   The script is Figma Plugin API code with a top-level `return`, not a Node
   script, so Biome ignores `*.figma.js`.
2. Save the returned JSON over `figma-variables.json`, then format and
   rebuild:

   ```sh
   pnpm exec biome format --write packages/tokens/figma-variables.json
   pnpm --filter @chores/tokens build
   ```

3. Review the `figma-variables.json` diff and commit it.

`use_figma` responses are cut off at about 20KB. The export rounds values and
fits easily today, at about 64 variables. If it starts coming back truncated,
export one collection per call and merge the results.

### Building from the live API (Enterprise only)

If `FIGMA_API_TOKEN` is set, the build skips the snapshot and fetches live:

- `FIGMA_API_TOKEN`: a personal access token with the
  `file_variables:read` scope, from a full seat on an Enterprise org.
- `FIGMA_FILE_KEY`: optional. It defaults to the `Chores` file
  (`xWedurFoYbsD1iw9WW9wii`).

```sh
FIGMA_API_TOKEN=figd_... pnpm --filter @chores/tokens build
```

CSS variable names are derived mechanically from each Figma variable's path
(`color/text/primary` → `--color-text-primary`), so a variable that's never
been given a semantic name in Figma (still auto-named after its own hex
value, e.g. `color/accent/60a5fa`) will generate an equally unhelpful CSS
variable name. Fix those by renaming the variable in Figma, not in this
package. Hand edits to `figma-variables.json` are lost on the next export.
