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

## src/domain/ — Schema types at every trust boundary (SPEC §10)

- `src/domain/reviewer-config.ts` — `ReviewerConfig` schema for the per-reviewer
  YAML (name, `mode` seam, paths, ignore with empty default, systemPrompt,
  rules); `runtime` mode is accepted by the schema, rejected by the engine in v1.
- `src/domain/staged-diff.ts` — `StagedDiff` schema: full diff text plus the
  staged file list.
- `src/domain/finding.ts` — `Severity`, the branded `Fingerprint`, the
  model-output `ModelFinding`/`ModelFindings` (no fingerprint), and the
  wrapper-fingerprinted `Finding`.
- `src/domain/run-key.ts` — `RunKey` schema (HEAD sha, branch, reviewer) and the
  `emptyRepoSentinel` head constant for repos without a HEAD.
- `src/domain/baseline.ts` — `Baseline` schema: findings carried between
  pre-commit attempts (Layer 2).
- `src/domain/run-record.ts` — `RunRecord` schema: diffHash, configHash,
  attempt, sessionId, ranAt, durationMs.
- `src/domain/suppression-list.ts` — `SuppressionList` schema: the decoded
  fingerprints from `.reviewer/ignore`.
- `src/domain/latest-projection.ts` — `ReviewerStatus`, `ReviewerOutcome`, and
  the `LatestProjection` schema (the `latest.json` shape).
- `src/domain/review-event.ts` — the ten tagged `ReviewEvent` variants and
  their union (SPEC §10), the input to the event reducer.
- `src/domain/errors.ts` — plain tagged errors (`GitError`, `ConfigError`,
  `AgentUnavailable`, `FindingsParseError`) with constructors, usable with
  `Effect.catchTags`; timeout uses Effect's `TimeoutException`.

## test/

- `test/core/result.test.ts` — unit tests for the Result type.
- `test/domain/reviewer-config.test.ts` — decode tests for `ReviewerConfig`,
  including YAML round-trips via the `yaml` package.
- `test/domain/staged-diff.test.ts` — decode tests for `StagedDiff`.
- `test/domain/finding.test.ts` — decode tests for `Fingerprint`,
  `ModelFinding`, `ModelFindings`, and `Finding`.
- `test/domain/run-key.test.ts` — decode tests for `RunKey` and the empty-repo
  sentinel.
- `test/domain/baseline.test.ts` — decode tests for `Baseline`.
- `test/domain/run-record.test.ts` — decode tests for `RunRecord`.
- `test/domain/suppression-list.test.ts` — decode tests for `SuppressionList`.
- `test/domain/latest-projection.test.ts` — decode tests for
  `LatestProjection` and all reviewer statuses.
- `test/domain/review-event.test.ts` — decode tests for every `ReviewEvent`
  variant of the union.
- `test/domain/errors.test.ts` — tests for the tagged error constructors and
  `Effect.catchTags` discrimination.
