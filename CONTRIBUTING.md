# Contributing

Thank you for looking. This is a small, deliberately plain project: a static site with no runtime
dependencies beyond React and Three.js, and data built from pinned upstream sources.

## What a pull request has to pass

Both of these run in CI on every pull request, and both have to be green before anything can be
merged or deployed.

```sh
npm run check      # types, lint, formatting, unit tests, coverage thresholds
npm run test:e2e   # the reader's flows, in a real browser against the built site
```

`npm run check` is the same command CI runs, so if it passes locally it passes there. It fails on:

- a TypeScript error (the config is strict, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`; there is no `any`, no `as` escape hatch and no `!`);
- an ESLint error (type-aware rules, so a floating promise or an unsafe value fails the build);
- a file Prettier would reformat — run `npm run format`;
- a failing unit test;
- **coverage below the gate** (85% of statements and lines, 84% of functions, 70% of branches; see `vite.config.ts`).

That last one means new code needs tests in the same pull request. If a change genuinely cannot
be unit-tested — GPU drawing, touch gestures, a page entry point — cover it in `tests/e2e/`
instead and say so in the pull request; the exclusion list in `vite.config.ts` explains the three
categories that are already treated this way.

The end-to-end suite needs the browser once: `npx playwright install --with-deps chromium`.

## Conventions

- **Comments explain why, never what.** The code says what it does; a comment is for the reason,
  the constraint or the thing that would otherwise look like a mistake.
- **Tests read as sentences about behaviour**, not about implementation: `it('opens the first
verse of a chapter given without one')`, not `it('calls indexOf')`.
- **Visualizations never import each other.** `src/app/views.ts` lists them and the app connects
  them; a repository test enforces it.
- **Data is pinned.** Upstream files are fetched against a SHA-256 in `data/sources.json` and the
  build refuses a file that does not match. Changing a source means re-pinning deliberately, with
  `npm run data:fetch -- --update`, and saying in the pull request what changed upstream.

## Data and licences

The datasets are built from CC BY 4.0 sources (OpenBible.info, STEP Bible / Tyndale House) and
public-domain texts. Every dataset carries its own licence and attribution fields, and the app
shows them in the footer and beside the words. If you add a source, it has to carry the same, and
columns whose licence does not permit redistribution must not be read — `scripts/data/importers/`
has a worked example, with a test that guards it.

See the [README](README.md#development) for the project layout and how the data pipeline works.
