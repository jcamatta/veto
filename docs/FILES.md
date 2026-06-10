# File responsibilities

One file === one responsibility. This document lists every file in the repo and
what it is about. **It must be updated in the same change whenever a file is
added, edited, renamed, or deleted.**

## Root

- `CLAUDE.md` — project context for Claude Code: workflow rules, code
  conventions, quality gates, documentation discipline.
- `package.json` — package manifest: name `veto`, ESM, Node >= 20,
  `bin` entry, scripts (`build`, `test`, `coverage`, `lint`, `typecheck`,
  `type-coverage`, `check`), dependencies.
- `tsconfig.json` — TypeScript strict ESM (NodeNext) compiler configuration,
  `noEmit` (tsup handles builds), node types enabled for the adapters.
- `eslint.config.js` — flat eslint config: typescript-eslint
  strict-type-checked + stylistic, eslint-plugin-functional (immutability,
  no-let, no-throw, no loops), style bans (no console, no inline comments, no
  default exports), a ban on all suppression directives (`eslint-disable*` via
  eslint-comments/no-use, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` via
  ban-ts-comment), hard size/complexity limits on `src/**`, and a ban on
  `node:*`/SDK imports inside `src/core|domain|ports` (hexagon purity).
- `vitest.config.ts` — vitest configuration with v8 coverage and 80% thresholds
  on lines/branches/functions/statements.
- `tsup.config.ts` — build configuration: bundles `src/cli.ts` to ESM
  `dist/cli.js` with a node shebang.
- `README.md` — user-facing documentation: install, CLI usage, exit codes,
  config format, re-run behavior (replay + baseline), escape hatches,
  outputs, sandboxing.
- `.gitignore` — excludes node_modules, dist, coverage, logs, .env.
- `.husky/pre-commit` — pre-commit gate: commit-size budget first, then lint,
  typecheck, tests with coverage, type coverage, build + dogfood
  (`veto .veto/ --staged`).
- `.husky/check-commit-size.sh` — enforces the commit size budget on the
  staged diff: ≤ 300 weighted source lines, ≤ 15 source files, test changes
  required past 30 source lines (locks, generated output, docs, and .husky
  itself excluded).
- `.veto/architect.yaml` — the dogfood reviewer config for this repo:
  judgment rules (one file one responsibility, effects at the edges, no
  duplication, behavior-focused tests) over `src`/`test`; documentation is
  out of its scope and it is told to read sparingly (token cost).

## docs/

- `docs/SPEC.md` — the product & technical specification (source of truth for
  all decisions).
- `docs/PLAN.md` — the phased implementation plan derived from the spec, with
  a status section tracking which phases are done (updated after every phase).
- `docs/ACCEPTANCE.md` — the v1 acceptance walk: each SPEC §14 criterion
  mapped to its automated tests plus the manual real-model verification
  results, and the final quality-gate audit.
- `docs/BENCH.md` — design contract for the real-model benchmark harness
  (`npm run bench`): metrics, fixtures, matrix, executable budgets
  (wall time / turns / cost / finding stability / fail-open rate), and the
  `apiKeySource` accounting of whose credit each run burns.
- `docs/plans/` — one design doc per feature (motivation + steps); features
  are planned here instead of growing docs/PLAN.md.
- `docs/plans/rule-ids.md` — stable rule ids on reviewer configs: fingerprint
  stability under rule rewording, schema-enforced rule citation, per-rule
  bench analytics (a manual `version:` field was rejected — `configHash`
  already does that job).
- `docs/plans/veto-init.md` — `veto init` scaffolding command: stack
  detection, cost-tuned starter YAML, idempotent husky wiring, CLAUDE.md
  snippet.
- `docs/plans/scoped-diff.md` — per-reviewer diff scoping: each reviewer is
  shown only its in-scope hunks, and the replay cache is keyed on the scoped
  diff (trust, cost, cache stability).
- `docs/FILES.md` — this document.

## src/core/ — pure calculations (functional core, no `node:*`/git/SDK imports)

- `src/core/result.ts` — the local `Result<Ok, Err>` discriminated union with
  constructors (`ok`, `err`), guards (`isOk`, `isErr`), and `map`; used by pure
  code where Effect is overkill.
- `src/core/glob-scope.ts` — `scopeFiles`: config `paths`/`ignore` globs ×
  staged file list → in-scope files and the matched/skip decision (picomatch).
- `src/core/diff-scope.ts` — `scopeDiff`: split the unified diff into
  per-file segments (`diff --git` headers) and keep only the reviewer's
  in-scope files, so each reviewer is shown — and its replay cache is keyed
  on — only the hunks it judges; preamble and unparseable text are kept
  (fail-safe).
- `src/core/hashing.ts` — the injected `HashFn` type plus `diffHash`,
  `configHash`, and the Layer-1 `replayKey` (hash of both hashes); the actual
  sha1 lives in an adapter so the core stays free of `node:crypto`.
- `src/core/fingerprint.ts` — `normalizeSnippet` (strip leading line numbers
  — digits followed by whitespace — then all whitespace; idempotent) and
  `fingerprintFinding`: ModelFinding →
  `hash(reviewer + rule + file + normalizedMessage)` truncated to 12 hex chars.
- `src/core/suppression.ts` — `parseSuppressions` (`.veto/ignore` text →
  `SuppressionList`, `#` comments allowed, `Result` with `ConfigError`) and
  `filterSuppressed` (drop suppressed findings, report their fingerprints).
- `src/core/baseline-diff.ts` — `diffBaseline`: previous baseline × current
  findings → resolved fingerprints / persisting / fresh, matched by fingerprint.
- `src/core/prompt.ts` — `buildPrompt`: systemPrompt + rules (identified
  rules render as `[id] text` and findings must cite the id) + staged files +
  diff + optional baseline with Layer-2 instructions + strict-JSON output
  instruction; `appendParseRetry` appends the schema error for the one
  findings-decode retry.
- `src/core/rules.ts` — `ruleKey` / `ruleText` / `ruleKeys`: project a
  `ReviewerRule` (plain string or `{id, rule}`) onto the key findings cite
  and the prose the prompt renders.
- `src/core/findings-schema.ts` — `findingsSchemaFor`: the `ModelFindings`
  JSON schema with the `rule` property constrained to the reviewer's rule
  keys (ids, or literal texts for plain rules), so the backend validates
  rule citations instead of trusting the model to echo them.
- `src/core/path-normalize.ts` — pure path helpers for the policy function:
  separator unification, dot-segment collapsing, drive-letter lowering,
  `isAbsolutePath`, and `resolveWithin` (resolve against a root).
- `src/core/tool-policy.ts` — `evaluateToolCall` (restriction ring 3):
  deny-by-default tool allowlist (Read/Grep/Glob), repo-root containment,
  settings-provided runs-dir denial, optional strict scope globs.
- `src/core/reducer.ts` — `RunState`, `initialState`, and the curried event
  reducer `reduce(state)(event)` folding the `ReviewEvent` union into
  per-reviewer outcomes, key/attempt/hashes, and the blocking flag.
- `src/core/exit-code.ts` — `isBlocking` (any error-severity finding) and the
  severity → exit code mapping (`0`/`1`; `2` is CLI misuse, mapped elsewhere).
- `src/core/projection.ts` — `buildProjection`: `RunState` + timestamp + git
  head/branch → `LatestProjection` (the `latest.json` shape), blocking derived
  from findings.
- `src/core/agent-output.ts` — pull the final result out of the raw agent
  message stream: `resultText` (last `{ type: 'result', result }`),
  `structuredOutput` (the last result message's validated
  `structured_output`), and `structuredRetriesExhausted` (the
  `error_max_structured_output_retries` subtype).
- `src/core/findings-parse.ts` — decode findings from agent output:
  `parseFindings` (locate the trailing strict-JSON object in result text;
  tolerates prose and a trailing fence) and `structuredFindings` (decode an
  already-parsed structured-output value); both
  `Result<ModelFindings, FindingsParseError>`.
- `src/core/agent-stats.ts` — `emptyStats`, `accumulateMessage`, and
  `bumpDenials`: fold raw agent messages into `ReviewerStats` (usage incl.
  cache creation/read tokens, cost, turns, duration from result messages;
  model and tool_use counts from assistant messages; denial counter),
  tolerant of unknown shapes.
- `src/core/stats-format.ts` — `formatStats`: `ReviewerStats` → the one-line
  human-readable stats summary shared by the pretty and markdown renderers
  (null segments dropped).
- `src/core/markdown.ts` — `renderMarkdown`: `LatestProjection` → the
  human-readable `latest.md` document, incl. per-reviewer stats line and
  fail-open cause.
- `src/core/pretty.ts` — `renderPretty`: `LatestProjection` → the terminal
  summary text (findings per reviewer, blocking verdict, pointer to
  `latest.md`) used by the pretty report format.

## src/ports/ — the hexagon's interfaces (Effect services, SPEC §10)

- `src/ports/git.ts` — the `Git` port: `GitService` (stagedDiff, head, branch,
  stagedFile) failing with `GitError`, plus the `Git` Context tag.
- `src/ports/agent.ts` — the `Agent` port: `AgentRunInput` (prompt, injected
  tool-call policy, limits, opaque `outputSchema`/`model`/`effort` hints
  interpreted only by adapters), the `AgentStreamItem` union
  (`AgentMessage`/`AgentDenial`), and
  `AgentService.run` returning a `Stream` failing with `AgentUnavailable`;
  the `Agent` Context tag.
- `src/ports/run-store.ts` — the `RunStore` port: appendEvent (per key +
  attempt), baseline/record read-write, writeProjections (projection +
  rendered markdown), and prune (keep last N heads); the `RunStore` tag.
- `src/ports/reporter.ts` — the `Reporter` port: `ReportFormat`
  (`pretty`/`json`) and `emit(projection, format)`; the `Reporter` tag.
- `src/ports/clock.ts` — the `ReviewClock` port (named to avoid clashing with
  Effect's own `Clock`): `now` as `Effect<DateTime.Utc>`; the tag.

## src/adapters/ — production adapters (real I/O at the edges, SPEC §10)

- `src/adapters/sha1.ts` — the real `HashFn`: hex sha1 via `node:crypto`
  (fingerprints, diff/config hashes, replay keys).
- `src/adapters/system-clock.ts` — `systemClockLive`: the `ReviewClock` port
  backed by `DateTime.now`.
- `src/adapters/command-git.ts` — the `Git` port via `@effect/platform`
  `Command`: staged diff (`-U15`) + name-only file list, HEAD (empty-repo
  sentinel when the repo has no commits), branch (symbolic-ref with detached
  fallback), staged file content (`git show :0:path`); optional `cwd`,
  non-zero exits become `GitError`.
- `src/adapters/fs-run-store.ts` — the `RunStore` port on `FileSystem` under a
  runs dir: self `.gitignore` containing `*`, JSONL event append per
  key/attempt, Schema-encoded baseline/record/latest read-write (corrupt or
  missing reads → null), prune to the most recent N HEAD dirs by mtime; store
  write failures die (not part of fail-open).
- `src/adapters/terminal-reporter.ts` — the `Reporter` port on
  `@effect/platform` `Terminal`: pretty format via `renderPretty`, json format
  via the Schema-encoded `LatestProjection`.
- `src/adapters/sdk-agent.ts` — the `Agent` port via
  `@anthropic-ai/claude-agent-sdk` `query()` wrapped with
  `Stream.fromAsyncIterable`: read-only allowlist (Read/Grep/Glob), `maxTurns`,
  `settingSources: []`, repo-root `cwd`, and `outputFormat` (json_schema)
  when an output schema is requested; the injected policy runs in the SDK's
  `canUseTool` callback, denials are queued and interleaved into the stream as
  `AgentDenial`; every failure maps to `AgentUnavailable`; the query function
  is injectable so tests spend zero credits.
- `src/adapters/config-loader.ts` — YAML config discovery (file or directory
  of `*.yaml`/`*.yml`, sorted) → parse → `Schema.decodeUnknown(ReviewerConfig)`;
  returns config + raw source text (the Layer-1 config-hash input); all
  failures are `ConfigError`.

## src/engine/ — pipeline orchestration (the engine, SPEC §10 & §12)

- `src/engine/inputs.ts` — the engine's input contract: `ReviewerSource`
  (config + raw YAML source), `RunSettings` (hash, repo root, suppressions,
  no-cache, strict scope, timeout), `ReviewContext` (settings + staged diff +
  head/branch), `RunReviewInput`, and the 90 s `defaultTimeoutMs`.
- `src/engine/reviewer-run.ts` — the per-reviewer run value (`ReviewerRun`:
  context, key, attempt, baseline, hashes), `appendEvents` (the event-log
  side channel into `RunStore`), and the `RunStarted` event constructor.
- `src/engine/agent-session.ts` — one fresh agent session: stream items
  mapped to `AgentEvent`/`ToolCallDenied`, tapped to the store, and returned
  for the reducer fold; the findings JSON schema is requested via the port's
  `outputSchema`, structured output is preferred when present (no engine
  retry — the backend already validated), and the text-parse path keeps
  exactly one retry with the schema error appended.
- `src/engine/reviewer-conclude.ts` — the successful-session tail:
  fingerprint findings, filter suppressions, diff against the baseline,
  emit `FindingsDecoded`/`FindingSuppressed`/`BaselineResolved`, and persist
  the new baseline and run record.
- `src/engine/run-reviewer.ts` — `runReviewer` per SPEC §10: glob-scope skip
  → diff scoped to the reviewer's globs (prompt and Layer-1 diff hash both
  use the scoped diff) → replay check (record hash comparison) → live agent
  session with injected tool policy and per-reviewer knobs (model/effort/
  maxTurns from the config, config timeout overriding the run timeout), and
  typed fail-open
  (`AgentUnavailable`/`FindingsParseError`/`TimeoutException` →
  `ReviewerFailed`).
- `src/engine/run-review.ts` — the whole-run command: reject `runtime` mode,
  gather git context, run reviewers with concurrency 4, fold events through
  the reducer, write projections, prune to 10 heads, report, and derive the
  exit code.

## src/cli/ — the user-facing command (thin command/query dispatcher, SPEC §3)

- `src/cli.ts` — the executable entry point bundled to `dist/cli.js`: wires
  `makeCli` to the real `process` (argv, `process.exit`) and the
  `NodeContext` platform layer, run via `NodeRuntime.runMain`.
- `src/cli/options.ts` — the `@effect/cli` surface: positional config
  dir/file, repeatable `--config`, `--staged`, `--format=pretty|json`
  (default pretty), `--no-cache`, `--timeout` (seconds), with help
  descriptions; the decoded `CliArgs` type.
- `src/cli/repo-root.ts` — `resolveRepoRoot`: `git rev-parse --show-toplevel`
  via `@effect/platform` `Command` (optional cwd for tests); non-zero exit →
  `GitError` ("not a git repository", CLI misuse).
- `src/cli/prepare.ts` — `prepare`: `CliArgs` + repo root → the engine's
  `RunReviewInput` plus the runs dir; resolves targets (positional +
  `--config`, none → `ConfigError`), loads configs, anchors
  `<base>/runs` and the `<base>/ignore` suppression file next to the
  configs, and fills `RunSettings` (sha1, default timeout).
- `src/cli/layers.ts` — `productionLayers`: merges the production adapters
  (command git, sdk agent, fs run store, terminal reporter, system clock)
  for a given repo root + runs dir; optional `queryFn` pass-through so CLI
  tests spend zero credits.
- `src/cli/command.ts` — `makeCli`: the `veto` command (resolve repo root →
  prepare → `runReview` → exit with the run's code) plus exit-code mapping
  per SPEC §3 (`ConfigError`/`GitError`/flag validation errors → exit 2)
  through an injected `exit` effect; `cwd`/`queryFn` injectable for tests.

## src/domain/ — Schema types at every trust boundary (SPEC §10)

- `src/domain/reviewer-config.ts` — `ReviewerConfig` schema for the per-reviewer
  YAML (name, `mode` seam, paths, ignore with empty default, systemPrompt,
  rules as plain strings or `{id, rule}` with kebab-case ids unique per
  config, plus optional backend knobs: opaque `model`, `effort` level,
  `maxTurns`, `timeoutMs`); `runtime` mode is accepted by the schema,
  rejected by the engine in v1.
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
  fingerprints from `.veto/ignore`.
- `src/domain/latest-projection.ts` — `ReviewerStatus`, `ReviewerOutcome`
  (with optional per-reviewer `stats` and fail-open `failure` cause), and
  the `LatestProjection` schema (the `latest.json` shape).
- `src/domain/reviewer-stats.ts` — `ReviewerStats` schema: per-reviewer run
  statistics (model, turns, input/output and cache creation/read tokens,
  cost, duration — nullable when the backend does not report them — plus
  tool-call and denial counters).
- `src/domain/review-event.ts` — the ten tagged `ReviewEvent` variants and
  their union (SPEC §10), the input to the event reducer.
- `src/domain/errors.ts` — plain tagged errors (`GitError`, `ConfigError`,
  `AgentUnavailable`, `FindingsParseError`) with constructors, usable with
  `Effect.catchTags`; timeout uses Effect's `TimeoutException`.

## test/

- `test/core/result.test.ts` — unit tests for the Result type.
- `test/core/fake-hash.ts` — deterministic FNV-1a-based hex `HashFn` stub
  shared by core tests; keeps the suite free of `node:crypto`.
- `test/core/diff-scope.test.ts` — diff segmentation and scoping: glob
  filtering, scoped file list, full-segment preservation, preamble and
  unparseable fail-safes, identity on fully in-scope diffs.
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
- `test/core/rules.test.ts` — rule-helper projections for plain and
  identified rules (key, text, mixed-list keys).
- `test/core/findings-schema.test.ts` — rule-enum injection into the
  findings schema for identified, plain, and mixed rules; rest of the
  schema preserved.
- `test/core/prompt.test.ts` — prompt section assembly, baseline injection with
  Layer-2 instructions, strict-JSON tail, and the parse-retry suffix.
- `test/core/path-normalize.test.ts` — separator unification, dot collapsing,
  drive letters, absolute detection, root resolution.
- `test/core/tool-policy.test.ts` — allowlist, repo-root containment,
  runs-dir denial (relative and absolute, outside-root ignored), strict scope
  (acceptance criterion 8 surface).
- `test/core/reducer.test.ts` — every event variant plus fast-check properties
  (no mutation of input state; AgentEvent noise never changes the outcome).
- `test/core/exit-code.test.ts` — blocking detection per severity and exit-code
  mapping.
- `test/core/projection.test.ts` — projection from folded state plus git
  head/branch, derived blocking.
- `test/core/agent-output.test.ts` — result-text extraction: last result
  message wins, malformed shapes ignored.
- `test/core/findings-parse.test.ts` — findings JSON parsing: pure JSON,
  trailing JSON after prose, markdown fences, and the error cases (null
  text, no JSON, schema mismatch).
- `test/core/agent-stats.test.ts` — stats accumulation from result/assistant
  messages, summing across retry sessions, denial bumps, and tolerance of
  malformed raws.
- `test/core/stats-format.test.ts` — stats-line rendering: full, partial,
  and all-null shapes; denial suffix.
- `test/core/markdown.test.ts` — markdown rendering of header, findings,
  resolved fingerprints, empty reviewers, stats line, and fail-open cause.
- `test/core/pretty.test.ts` — terminal summary rendering: header, findings
  with locations/suggestions, resolved fingerprints, blocking verdict, report
  pointer.
- `test/adapters/fixture-git.ts` — fixture `Git` adapter: `fixtureGit` serving
  a canned diff/head/branch/staged-content map, and `failingGit` failing every
  method with `GitError` (for not-a-repo paths).
- `test/adapters/scripted-agent.ts` — scripted-stream `Agent` adapter (zero
  credits): a `ScriptStep` script (`Say` raw messages, `CallTool` attempts run
  through the injected policy → message or denial), call recording, and
  `unavailableAgent` failing with `AgentUnavailable`.
- `test/adapters/in-memory-run-store.ts` — in-memory `RunStore` adapter over
  Maps keyed by `head/reviewer`, exposing its memory for assertions; prune
  keeps the last N heads by insertion order.
- `test/adapters/collector-reporter.ts` — collector `Reporter` adapter
  recording every emitted projection + format in order.
- `test/adapters/fixed-clock.ts` — fixed `ReviewClock` adapter returning one
  constant `DateTime.Utc`.
- `test/adapters/fixture-git.test.ts` — fixture git serving diff/head/branch,
  staged-file hit and `GitError` miss, failingGit on all methods.
- `test/adapters/scripted-agent.test.ts` — scripted stream playback, policy
  wire-through (allowed tool call vs `AgentDenial`), call recording, and the
  `AgentUnavailable` failure stream.
- `test/adapters/in-memory-run-store.test.ts` — event append per key/attempt,
  baseline/record round-trips and null misses, key isolation, projection
  collection, and head pruning.
- `test/adapters/collector-reporter.test.ts` — ordered collection of emitted
  projections with formats.
- `test/adapters/fixed-clock.test.ts` — the fixed instant is returned on every
  read.
- `test/adapters/sha1.test.ts` — known sha1 vectors, determinism,
  discrimination.
- `test/adapters/system-clock.test.ts` — the system clock returns the current
  utc instant.
- `test/adapters/command-git.test.ts` — integration tests against real
  throwaway git repos in temp dirs: staged diff/files, head + branch, staged
  vs disk content, empty-repo sentinel, not-a-repo and missing-file
  `GitError`s.
- `test/adapters/fs-run-store.test.ts` — integration tests on a temp runs dir:
  self-gitignore creation, decodable JSONL event lines, baseline/record
  round-trips (corrupt → null), projection files, mtime-based head pruning.
- `test/adapters/terminal-reporter.test.ts` — pretty and json emission
  captured through a fake `Terminal`.
- `test/adapters/sdk-agent.test.ts` — the SDK adapter against an injected fake
  query (zero credits): message order, SDK option wiring, `canUseTool`
  allow/deny results, `AgentDenial` interleaving and trailing drain,
  `AgentUnavailable` mapping for stream and synchronous failures.
- `test/adapters/config-loader.test.ts` — file and directory discovery with
  raw-source round-trip, non-yaml exclusion, and `ConfigError`s for missing
  paths, empty dirs, malformed YAML, and schema rejections.
- `test/engine/run-review.test.ts` — integration tests for the whole engine
  on the fixture adapters (zero credits): completed/blocking runs, scope
  skip, Layer-1 replay and its busts (`--no-cache`, config edit), Layer-2
  baseline injection and resolution, suppression filtering, fail-open
  (unavailable, double parse failure, timeout) with retry recovery,
  tool-call denials incl. strict scope, and runtime-mode rejection
  (acceptance criteria 2–9).
- `test/cli/repo-root.test.ts` — toplevel resolution from the repo root and
  a subdirectory of real throwaway repos, `GitError` outside a repo.
- `test/cli/prepare.test.ts` — run-input assembly from a positional dir vs
  `--config` files (runs-dir anchoring, merge), flag propagation, ignore-file
  suppressions, and `ConfigError`s (no targets, missing path, bad
  fingerprints).
- `test/cli/command.test.ts` — end-to-end CLI runs in real temp git repos
  with an injected fake SDK query (zero credits): exit 0 clean / warnings,
  exit 1 on error findings, projections written, repeated `--config`, exit 2
  misuse (no repo, missing config, no targets, invalid flag), `--help`.
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
  `LatestProjection`, all reviewer statuses, and the optional stats/failure
  fields.
- `test/domain/reviewer-stats.test.ts` — decode tests for `ReviewerStats`
  (nullable usage, counter bounds).
- `test/domain/review-event.test.ts` — decode tests for every `ReviewEvent`
  variant of the union.
- `test/domain/errors.test.ts` — tests for the tagged error constructors and
  `Effect.catchTags` discrimination.
