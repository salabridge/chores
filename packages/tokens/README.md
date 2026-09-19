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

There's nothing to hand-edit — every `pnpm build` pulls the current values
straight from Figma's [local variables REST
endpoint](https://developers.figma.com/docs/rest-api/variables/) and
regenerates `dist/tokens.css` from scratch. To pick up a design change, just
rebuild.

This requires:

- `FIGMA_API_TOKEN` — a personal access token with the `file_variables:read`
  scope. This endpoint is Enterprise-org only, so the token must belong to a
  full seat on an Enterprise org with access to the file.
- `FIGMA_FILE_KEY` — optional, defaults to the `Chores` file
  (`xWedurFoYbsD1iw9WW9wii`).

```sh
FIGMA_API_TOKEN=figd_... pnpm --filter @chores/tokens build
```

CSS variable names are derived mechanically from each Figma variable's path
(`color/text/primary` → `--color-text-primary`), so a variable that's never
been given a semantic name in Figma (still auto-named after its own hex
value, e.g. `color/accent/60a5fa`) will generate an equally unhelpful CSS
variable name. Fix those by renaming the variable in Figma, not in this
package — there's no static file here to patch anymore.
