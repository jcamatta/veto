# File responsibilities

One file === one responsibility. This document lists every file in the repo and
what it is about. **It must be updated in the same change whenever a file is
added, edited, renamed, or deleted.**

## Root

- `CLAUDE.md` — project context for Claude Code: workflow rules, code
  conventions, quality gates, documentation discipline.
- `package.json` — package manifest: name `local-reviewer`, ESM, Node >= 20,
  `bin` entry, scripts (`build`, `test`, `coverage`, `lint`, `typecheck`,
  `type-coverage`, `check`), dependencies.
- `tsconfig.json` — TypeScript strict ESM (NodeNext) compiler configuration,
  `noEmit` (tsup handles builds).
- `eslint.config.js` — flat eslint config: typescript-eslint
  strict-type-checked + stylistic, eslint-plugin-functional (immutability,
  no-let, no-throw, no loops), style bans (no console, no inline comments, no
  default exports), and hard size/complexity limits on `src/**`.
- `vitest.config.ts` — vitest configuration with v8 coverage and 80% thresholds
  on lines/branches/functions/statements.
- `tsup.config.ts` — build configuration: bundles `src/cli.ts` to ESM
  `dist/cli.js` with a node shebang.
- `.gitignore` — excludes node_modules, dist, coverage, logs, .env.
- `.husky/pre-commit` — pre-commit gate: lint, typecheck, tests with coverage,
  type coverage.

## docs/

- `docs/SPEC.md` — the product & technical specification (source of truth for
  all decisions).
- `docs/PLAN.md` — the phased implementation plan derived from the spec.
- `docs/FILES.md` — this document.

## src/

- `src/core/result.ts` — the local `Result<Ok, Err>` discriminated union with
  constructors (`ok`, `err`), guards (`isOk`, `isErr`), and `map`; used by pure
  code where Effect is overkill.

## test/

- `test/core/result.test.ts` — unit tests for the Result type.
