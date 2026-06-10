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
- `docs/PLAN.md` — the phased implementation plan derived from the spec, with
  a status section tracking which phases are done (updated after every phase).
- `docs/FILES.md` — this document.

## src/core/ — pure calculations (functional core, no `node:*`/git/SDK imports)

- `src/core/result.ts` — the local `Result<Ok, Err>` discriminated union with
  constructors (`ok`, `err`), guards (`isOk`, `isErr`), and `map`; used by pure
  code where Effect is overkill.
- `src/core/glob-scope.ts` — `scopeFiles`: config `paths`/`ignore` globs ×
  staged file list → in-scope files and the matched/skip decision (picomatch).
- `src/core/hashing.ts` — the injected `HashFn` type plus `diffHash`,
  `configHash`, and the Layer-1 `replayKey` (hash of both hashes); the actual
  sha1 lives in an adapter so the core stays free of `node:crypto`.
- `src/core/fingerprint.ts` — `normalizeSnippet` (strip line numbers and all
  whitespace) and `fingerprintFinding`: ModelFinding →
  `hash(reviewer + rule + file + normalizedMessage)` truncated to 12 hex chars.
- `src/core/suppression.ts` — `parseSuppressions` (`.reviewer/ignore` text →
  `SuppressionList`, `#` comments allowed, `Result` with `ConfigError`) and
  `filterSuppressed` (drop suppressed findings, report their fingerprints).
- `src/core/baseline-diff.ts` — `diffBaseline`: previous baseline × current
  findings → resolved fingerprints / persisting / fresh, matched by fingerprint.
- `src/core/prompt.ts` — `buildPrompt`: systemPrompt + rules + staged files +
  diff + optional baseline with Layer-2 instructions + strict-JSON output
  instruction.
- `src/core/path-normalize.ts` — pure path helpers for the policy function:
  separator unification, dot-segment collapsing, drive-letter lowering,
  `isAbsolutePath`, and `resolveWithin` (resolve against a root).
- `src/core/tool-policy.ts` — `evaluateToolCall` (restriction ring 3):
  deny-by-default tool allowlist (Read/Grep/Glob), repo-root containment,
  `.reviewer/runs/` denial, optional strict scope globs.
- `src/core/reducer.ts` — `RunState`, `initialState`, and the curried event
  reducer `reduce(state)(event)` folding the `ReviewEvent` union into
  per-reviewer outcomes, key/attempt/hashes, and the blocking flag.
- `src/core/exit-code.ts` — `isBlocking` (any error-severity finding) and the
  severity → exit code mapping (`0`/`1`; `2` is CLI misuse, mapped elsewhere).
- `src/core/projection.ts` — `buildProjection`: `RunState` + timestamp →
  `LatestProjection` (the `latest.json` shape), blocking derived from findings.
- `src/core/markdown.ts` — `renderMarkdown`: `LatestProjection` → the
  human-readable `latest.md` document.

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
- `test/core/fake-hash.ts` — deterministic FNV-1a-based hex `HashFn` stub
  shared by core tests; keeps the suite free of `node:crypto`.
- `test/core/glob-scope.test.ts` — scope matching, ignore globs, dotfiles, and
  the no-match skip decision.
- `test/core/hashing.test.ts` — diff/config hash delegation and replay-key
  stability/sensitivity.
- `test/core/fingerprint.test.ts` — snippet normalization (incl. fast-check
  idempotence and whitespace-invariance properties) and fingerprint
  stability/discrimination.
- `test/core/suppression.test.ts` — suppression-file parsing (comments, blanks,
  invalid entries) and finding filtering.
- `test/core/baseline-diff.test.ts` — resolved/persisting/fresh partitioning,
  no-baseline and clean-run cases.
- `test/core/prompt.test.ts` — prompt section assembly, baseline injection with
  Layer-2 instructions, strict-JSON tail.
- `test/core/path-normalize.test.ts` — separator unification, dot collapsing,
  drive letters, absolute detection, root resolution.
- `test/core/tool-policy.test.ts` — allowlist, repo-root containment,
  `.reviewer/runs/` denial, strict scope (acceptance criterion 8 surface).
- `test/core/reducer.test.ts` — every event variant plus fast-check properties
  (no mutation of input state; AgentEvent noise never changes the outcome).
- `test/core/exit-code.test.ts` — blocking detection per severity and exit-code
  mapping.
- `test/core/projection.test.ts` — projection from folded state, derived
  blocking, empty-repo fallbacks.
- `test/core/markdown.test.ts` — markdown rendering of header, findings,
  resolved fingerprints, and empty reviewers.
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
