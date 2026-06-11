# veto — Implementation Plan

Derived from [SPEC.md](SPEC.md). Work proceeds phase by phase: implement → user
reviews → user approves → commit → next phase. **No commit without approval.**
Every phase keeps the quality gates green: lint, typecheck, tests, test coverage
> 80%, type coverage > 95%.

---

## Status (update at the end of every phase)

- [x] **Phase 1 — done, committed** (`a4df879`). All gates green.
- [x] **Phase 2 — done, committed** (`ea0e9b5`). All schemas/errors in
  `src/domain/`, `Result` in `src/core/result.ts`, decode tests for every
  schema.
- [x] **Phase 3 — done, committed** (`a6c61d7`). All pure calculations in
  `src/core/` with one test file each; gates green (128 tests, 100% line
  coverage, 100% type coverage). Implementation notes / deviations:
  - Added `picomatch` (+ `@types/picomatch` dev) for pure glob matching, as
    the plan allowed.
  - Hashing/fingerprinting take an injected `HashFn` — the core cannot import
    `node:crypto`; the real sha1 is a Phase-5 adapter concern. Tests use the
    FNV stub in `test/core/fake-hash.ts`.
  - Fingerprints normalize the finding `message` (the schema carries no
    snippet field), NUL-joined preimage, truncated to 12 hex chars.
  - The reducer is curried (`reduce(state)(event)`) to satisfy `max-params: 1`;
    shell code wraps it for `Stream.runFold`.
  - `buildProjection` derives `blocking` from findings, not from the
    `RunCompleted` event.
- [x] **Phase 4 — done, committed** (`eb7dce1`, includes the rename to
  `veto` and the suppression-directive lint ban). Ports as
  `Context.Tag` services in `src/ports/` (`Git`, `Agent`, `RunStore`,
  `Reporter`, `ReviewClock`), test adapters in `test/adapters/` (following the
  `fake-hash.ts` precedent — coverage only counts `src/**`); gates green
  (144 tests, 100% line & type coverage). Implementation notes / deviations:
  - The clock port is named `ReviewClock` to avoid clashing with Effect's
    built-in `Clock`; `now` returns `DateTime.Utc` (matches `ranAt` schemas).
  - `Agent.run` streams an `AgentStreamItem` union
    (`AgentMessage { raw }` / `AgentDenial { tool, path, reason }`) so the
    Phase-6 pipeline can map items to `AgentEvent` / `ToolCallDenied` events;
    the policy is injected as `(call: { tool, path }) => PolicyDecision` and
    the scripted test adapter actually invokes it (`CallTool` script steps).
  - `RunStore` methods carry no typed error (store failure is not part of the
    fail-open policy; production adapter will `orDie`). `writeProjections`
    takes the projection plus pre-rendered markdown.
  - Stateful test adapters (scripted agent's call log, in-memory store,
    collector reporter) hold state in Effect `Ref`s with readonly types —
    no lint relaxation; assertions read the state as an `Effect`.
  - eslint hardened: all suppression directives are now lint errors
    (`@eslint-community/eslint-comments/no-use` banning `eslint-disable*`,
    `ban-ts-comment` banning every `@ts-*` directive); added
    `@eslint-community/eslint-plugin-eslint-comments` dev dependency.
- [x] **Phase 5 — done, committed** (`bb13575`). Production adapters in
  `src/adapters/` (one file each: `command-git`, `fs-run-store`,
  `terminal-reporter`, `sdk-agent`, `config-loader`, plus `sha1` and
  `system-clock`); gates green (180 tests, 99.8% line / 99.9% type coverage).
  Implementation notes / deviations:
  - SDK permission API verified against the installed
    `@anthropic-ai/claude-agent-sdk`: the option is `canUseTool`
    (`(toolName, input, opts) => Promise<PermissionResult>` with
    `behavior: 'allow' | 'deny'`), wired to the injected pure policy. Policy
    denials are pushed onto an Effect `Queue` and interleaved into the
    returned stream as `AgentDenial` items; `settingSources: []` keeps runs
    deterministic; all failures map to `AgentUnavailable` (fail-open input).
  - The SDK `query` function is injectable (`queryFn` option) so the adapter's
    full behavior is tested with zero credits (acceptance criterion 9).
  - Added `@types/node` (dev) and set tsconfig `types: ["node"]` for
    `node:crypto` in the sha1 adapter; compensated with an eslint
    `no-restricted-imports` ban on `node:*`/`@anthropic-ai/*` inside
    `src/core|domain|ports` so the hexagon stays enforced by lint.
  - `Reporter` rides `@effect/platform` `Terminal` (`display` is undecorated
    stdout, trivially fakeable) instead of `console`; the pure pretty renderer
    lives in `src/core/pretty.ts` next to the other projection renderers.
  - `commandGit` takes an optional `cwd` so tests can target throwaway repos;
    empty repo → sentinel head with the unborn branch name from
    `symbolic-ref`; detached HEAD falls back to `rev-parse --abbrev-ref`.
  - `fs-run-store` prunes HEAD dirs by mtime (newest N kept) and treats
    unreadable/corrupt baseline or record files as null (no baseline).
- [x] **Phase 6 — done, committed** (`403d0a4`). The engine in `src/engine/`
  (`inputs`, `reviewer-run`, `agent-session`, `reviewer-conclude`,
  `run-reviewer`, `run-review`) plus two new core calculations
  (`agent-output`, `findings-parse`) and `appendParseRetry` in `prompt`;
  gates green (227 tests, 99.7% line / 99.9% type coverage).
  Implementation notes / deviations:
  - `buildProjection` now takes git `head`/`branch` directly (git is the
    truth) instead of falling back to the empty-repo sentinel from event
    state; the empty-repo sentinel is already produced by the git adapter.
  - The per-reviewer timeout is `RunSettings.timeoutMs` (engine exports
    `defaultTimeoutMs = 90_000` for the Phase-7 CLI) so the timeout path is
    testable without a test clock; `maxTurns` stays a fixed engine constant
    (15).
  - Layer-1 replay compares `record.diffHash`/`configHash` (equivalent to
    the spec's combined replay key); a replay re-emits
    `RunStarted`/`FindingsDecoded` from the baseline plus `ReplayServed`,
    and re-applies the suppression filter so new suppressions take effect
    on replayed findings too.
  - Decode-retry is a second fresh agent session with the schema error
    appended (`appendParseRetry`); both sessions' events land in the same
    attempt's JSONL log.
  - `RunCompleted` is folded into state but not persisted to a per-reviewer
    event log (the log is keyed per reviewer; the outcome lives in the
    projections).
  - Fail-open writes no `record.json`/`baseline.json` (a failed run must
    not feed the replay cache); only the `ReviewerFailed` event is logged.
- [x] **Phase 7 — done, committed** (`7918517`; the `normalizeSnippet`
  idempotence fix landed separately as `23cb939`). The CLI in `src/cli/`
  (`options`, `repo-root`, `prepare`, `layers`, `command`) plus the
  `src/cli.ts` entry point; `tsup` build verified (`dist/cli.js` runs:
  skip-path review exit 0, `--help`/`--version` exit 0, bad flag exit 2);
  gates green (231 tests, 99.2% line / 99.9% type coverage).
  Implementation notes / deviations:
  - Exit-code mapping (SPEC §3) lives in `makeCli`: handler errors
    (`ConfigError`, `GitError` from repo-root resolution) and
    `@effect/cli` validation errors all map to exit 2 through an injected
    `exit` effect; production exits via `process.exit` (no `process.exitCode`
    mutation — `functional/immutable-data` stays clean).
  - `--staged` is accepted but is a documented no-op: v1 always reviews the
    staged diff (the help text says so).
  - The `.veto/ignore` suppression file and the `runs/` dir are anchored
    next to the configs: the positional directory when given, else the
    first `--config` file's directory.
  - `repoRoot` comes from `git rev-parse --show-toplevel` (a CLI-local
    helper, not a `Git` port method) so invocation from a subdirectory
    resolves containment and the agent cwd correctly.
  - `makeCli` takes injectable `cwd`/`queryFn`/`exit`, so the CLI is tested
    end-to-end in temp git repos with a fake SDK query (zero credits).
  - Drive-by fix surfaced by a fast-check seed: `normalizeSnippet` was not
    idempotent (a bare number like `"0 0"` was eaten as a "line number" on
    re-normalization); the line-number regex now requires trailing
    whitespace, making normalization idempotent by construction.
- [x] **Phase 8 — done, committed** (`49de9f0`). All 9 acceptance criteria walked in
  [ACCEPTANCE.md](ACCEPTANCE.md) (automated tests + manual real-model runs in
  a throwaway repo: blocking find, replay, suppression-on-replay, baseline
  resolution); dogfood wired (`.veto/architect.yaml`, build + veto run in
  `.husky/pre-commit`, CLAUDE.md feedback-loop line); README written; gates
  green (231 tests, 99.2% line / 99.94% type coverage).
  Implementation notes / deviations:
  - The hook dogfoods via `npm run build && node dist/cli.js .veto/
    --staged` (not `npx veto`) because the package is not installed into
    itself; the skip-path run costs ~1.3 s, a real review ~16 s.
  - Criterion 2 measured as marginal cost: a second non-matching reviewer
    adds ~20 ms to the run (< 100 ms), zero model calls.
- [x] **Phase 9 — done.** Tasks 1–4 shipped incrementally after Phase 8
  (run-summary stats, structured outputs, per-reviewer knobs + `--timeout`,
  the `.veto` rename). Task 5 (`claude_code` preset system prompt) shipped
  last: `buildPrompt` splits system vs user text and the SDK adapter sends
  the system text via the preset with `excludeDynamicSections: true`.

## Phase 1 — Scaffold & tooling

Goal: an empty but fully gated project. Everything after this phase is written
under enforced rules.

- `git init` (branch `main`), root `.gitignore`.
- `package.json`: ESM, `engines.node >= 20`, `bin: { "veto": "dist/cli.js" }`,
  scripts (`build`, `test`, `coverage`, `lint`, `typecheck`, `type-coverage`, `check`).
- Dependencies: `effect`, `@effect/cli`, `@effect/platform`, `@effect/platform-node`,
  `@anthropic-ai/claude-agent-sdk`, `yaml`, `tinyglobby`.
  Dev: `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `@effect/vitest`,
  `fast-check`, `eslint` + `typescript-eslint` (strict-type-checked) +
  `eslint-plugin-functional`, `type-coverage`, `husky`.
- `tsconfig.json`: `strict`, ESM (`NodeNext`), `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`.
- `eslint.config.js`: strict-type-checked + functional preset, plus:
  - no `let`/`var` (`prefer-const`, `no-var`, `functional/no-let`),
    immutability (`functional/prefer-readonly-type` family, `functional/immutable-data`),
  - `no-console`, `no-throw` (functional), `import/no-default-export` equivalent,
    single-export-at-end convention, no inline comments (`line-comment-position` / `no-inline-comments`),
  - hard limits on `src/**/*.{ts,tsx}`: `max-params: 1`,
    `max-lines-per-function: 75` (skip blanks/comments, IIFEs), `max-lines: 250`,
    `max-statements: 12`, `max-depth: 3`, `complexity: 8`,
    `max-nested-callbacks: 3`, `max-classes-per-file: 1`.
- `vitest.config.ts` with v8 coverage thresholds: lines/branches/functions/statements ≥ 80.
- `type-coverage` config: `--at-least 95 --strict`.
- Husky `pre-commit`: lint → typecheck → tests with coverage → type-coverage.
- `docs/FILES.md` created, listing every file and its single responsibility
  (later removed — it conflicted constantly across parallel branches).
- Smoke source file + test so every gate runs against real code.

Exit criteria: `npm run check` green; pre-commit hook blocks on any gate failure.

## Phase 2 — Domain data model (Schema types & errors)

Goal: all immutable data crossing boundaries, defined with `effect/Schema`.

- `src/domain/`: `ReviewerConfig` (with `mode` seam, runtime rejected in v1),
  `StagedDiff`, `Finding`, `Baseline`, `RunRecord`, `SuppressionList`,
  `LatestProjection`, the `ReviewEvent` union (SPEC §10), `RunKey`
  (HEAD sha, branch, reviewer; empty-repo sentinel).
- Tagged errors: `GitError`, `ConfigError`, `AgentUnavailable`,
  `FindingsParseError` (timeout uses Effect's `TimeoutException`).
- A small `Result<Ok, Err>` type for pure code where Effect is overkill.
- Decode tests for every schema (valid/invalid fixtures), including YAML config
  decoding via the `yaml` package.

## Phase 3 — Pure calculations (functional core)

Goal: the most-tested code in the repo, zero imports of `node:*`/git/SDK.

- Glob matching: config `paths`/`ignore` × staged file list → in-scope files / skip.
- Replay-key hashing (diff text + config content) and diff hashing.
- Fingerprinting: snippet normalization (strip whitespace/line numbers) +
  `sha1(reviewer + rule + file + normalizedSnippet)`.
- Suppression filtering (`.veto/ignore` parsing + drop matching findings).
- Baseline diffing: resolved / persisting / new (by fingerprint).
- Prompt building: systemPrompt + rules + diff + baseline + Layer-2 instructions
  + strict-JSON output instruction.
- Tool-call policy function (ring 3): deny-by-default, repo-root containment,
  deny `.veto/runs/`, strict scope option.
- Event reducer `reduce(state, event) -> state`; severity → exit code.
- Projection renderers: `latest.json` shape and `latest.md` markdown.
- Property tests (fast-check) on reducer and fingerprint normalization.

## Phase 4 — Ports & test adapters

Goal: the hexagon's interfaces plus fixture adapters so the whole engine is
testable with zero credits (acceptance criterion 9).

- Port definitions as Effect services: `Git`, `Agent`, `RunStore`, `Reporter`, `Clock`.
- Test adapters: fixture `Git`, scripted-stream `Agent`, in-memory `RunStore`,
  collector `Reporter`, fixed `Clock`.

## Phase 5 — Production adapters

Goal: real I/O at the edges, each adapter one file.

- `Git` via `@effect/platform` `Command` (`diff --staged -U15`, `--name-only`,
  HEAD, branch, `git show :0:path`; empty-repo handling).
- `RunStore` on FileSystem under `.veto/runs/` (self `.gitignore` with `*`,
  JSONL append, baseline/record/latest read-write, prune to last 10 HEAD keys).
- `Reporter`: terminal pretty + JSON formats.
- `Agent` via `@anthropic-ai/claude-agent-sdk` `query()` →
  `Stream.fromAsyncIterable`; allowedTools `Read`/`Grep`/`Glob`; wire the policy
  function through the SDK's permission callback (**verify current option name**,
  `canUseTool` vs hooks, against the SDK docs); `maxTurns` 15, abort signal;
  map credit-exhausted/offline to `AgentUnavailable`.
- Config loader: YAML file/dir discovery → `Schema.decodeUnknown`.

## Phase 6 — Pipeline orchestration

Goal: the engine. `runReviewer` per SPEC §10 wiring core + ports.

- Per reviewer: skip on no glob match → Layer-1 replay check → baseline load →
  fresh agent session (full diff every run) → decode findings with one retry
  (schema error appended) → fingerprint → suppression filter → baseline events.
- Event log tapped to `RunStore` as side channel; state = fold of events.
- 90 s timeout per reviewer; fail-open on `AgentUnavailable` / timeout / parse
  failure after retry (typed catchTags, never try/catch).
- `Effect.all(..., { concurrency: 4 })`; projections written; pruning; exit-code
  derivation (0 / 1 / 2 per SPEC §3).
- Integration tests entirely on test adapters (re-run/baseline behavior,
  replay, suppression, fail-open — acceptance criteria 2–9).

## Phase 7 — CLI

Goal: the user-facing command via `@effect/cli`.

- Args: positional config dir, repeatable `--config`, `--staged`,
  `--format=pretty|json`, `--no-cache`; help text.
- Thin command/query dispatcher over the Phase-6 engine; exit code mapping
  (2 for misuse: bad config, not a git repo, bad flags).
- `tsup` build producing `dist/cli.js`; `npx veto` works locally.

## Phase 8 — Hardening, dogfood & acceptance

Goal: v1 done per SPEC §14.

- Walk all 9 acceptance criteria with explicit tests or manual verification.
- End-to-end dogfood: a `.veto/` config in this repo, hook line in
  `.husky/pre-commit` (after eslint), CLAUDE.md feedback-loop line.
- README (install, usage, config format, escape hatches).
- Coverage and type-coverage audits.

## Phase 9 — Observability, SDK upgrades & generalization (v1.1)

Motivated by the first real dogfood runs (Phase 8): a pluma review hit the
90 s timeout while rate-limit-throttled mid-thinking, and diagnosing it
required reading raw JSONL. Five tasks, each shippable and reviewable on its
own; SPEC.md is updated alongside each task it touches.

The guiding constraint for every task: **the `Agent` port stays
backend-agnostic.** Reviewer configs carry opaque data (`model`, `effort`);
only the adapter interprets it. A future codex/local-model reviewer is a new
adapter implementing the same port — nothing in core/domain/engine may
reference SDK concepts.

1. **Run-summary observability** (first — everything else is tuned by what
   this reveals). A pure calculation folds the agent stream into per-reviewer
   stats: turns, input/output/cache tokens, cost (the SDK result message
   carries `usage`/`total_cost_usd`/`num_turns`/`duration_ms`), tool calls,
   denials. Persisted in `record.json`, exposed per reviewer in
   `latest.json`/`latest.md`, one stats line in the pretty output. Fail-open
   outcomes name their cause (timeout / unavailable / parse) instead of a
   bare `unavailable`. Spec: §6 record.json, §9 projection shape.
2. **Structured outputs.** The SDK adapter passes
   `outputFormat: { type: "json_schema", schema }` built from
   `ModelFindings`; the SDK validates and retries internally and delivers
   `structured_output` on the result message. The engine prefers structured
   output when the stream provides it and falls back to text parsing
   (keeps non-SDK backends viable); `error_max_structured_output_retries`
   maps to `FindingsParseError` → fail-open. The hand-rolled second retry
   session goes away. Spec: §9.
3. **Per-reviewer knobs + `--timeout`.** Optional `ReviewerConfig` fields
   `model` (opaque string), `effort`, `maxTurns`, `timeoutMs`, flowing
   through `AgentRunInput` as data; the SDK adapter maps them to query
   options, other adapters interpret or ignore. CLI `--timeout` overrides
   the default for all reviewers. Recommended default documented and used in
   our own config: `model: claude-sonnet-4-6`, `effort: medium` (cheap,
   fast, less runaway thinking on a $20 plan). Spec: §3, §4, §8.
4. **Rename `.reviewer` → `.veto`.** The tool policy denies the
   settings-provided runs dir rather than a hardcoded `.reviewer/runs`
   name; dogfood dir, hook line, CLAUDE.md feedback line, README, SPEC all
   move to `.veto/`. The CLI already accepts any directory. Spec: §3, §6, §8.
5. **`claude_code` preset system prompt.** `buildPrompt` splits system vs
   user sections; `AgentRunInput` carries the system text separately; the
   SDK adapter sends `systemPrompt: { type: "preset", preset:
   "claude_code", append: <system>, excludeDynamicSections: true }` (the
   docs endorse the preset for unattended diff review; the flag keeps the
   prompt cacheable across machines). `settingSources` stays `[]` — no
   CLAUDE.md/AGENTS.md auto-injection, because any input that changes review
   output must be part of the Layer-1 cache key. Spec: §5, §7.

Out of scope for this phase (v2 candidates): codebase-graph custom tool via
`@tool`/MCP (measure first — the timeout run never reached its tools),
ag-ui event adapter.

---

## Out of scope (v2 — do not build)

`mode: runtime`, PR-comment GitHub Action, eslint-JSON context feeding, shared
rule sets, MCP server, interactive mode.
