# local-reviewer — Implementation Plan

Derived from [SPEC.md](SPEC.md). Work proceeds phase by phase: implement → user
reviews → user approves → commit → next phase. **No commit without approval.**
Every phase keeps the quality gates green: lint, typecheck, tests, test coverage
> 80%, type coverage > 95%, and [FILES.md](FILES.md) updated.

---

## Phase 1 — Scaffold & tooling

Goal: an empty but fully gated project. Everything after this phase is written
under enforced rules.

- `git init` (branch `main`), root `.gitignore`.
- `package.json`: ESM, `engines.node >= 20`, `bin: { "local-reviewer": "dist/cli.js" }`,
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
- `docs/FILES.md` created, listing every file and its single responsibility.
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
- Suppression filtering (`.reviewer/ignore` parsing + drop matching findings).
- Baseline diffing: resolved / persisting / new (by fingerprint).
- Prompt building: systemPrompt + rules + diff + baseline + Layer-2 instructions
  + strict-JSON output instruction.
- Tool-call policy function (ring 3): deny-by-default, repo-root containment,
  deny `.reviewer/runs/`, strict scope option.
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
- `RunStore` on FileSystem under `.reviewer/runs/` (self `.gitignore` with `*`,
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
- `tsup` build producing `dist/cli.js`; `npx local-reviewer` works locally.

## Phase 8 — Hardening, dogfood & acceptance

Goal: v1 done per SPEC §14.

- Walk all 9 acceptance criteria with explicit tests or manual verification.
- End-to-end dogfood: a `.reviewer/` config in this repo, hook line in
  `.husky/pre-commit` (after eslint), CLAUDE.md feedback-loop line.
- README (install, usage, config format, escape hatches).
- Coverage and type-coverage audits; final FILES.md sweep.

---

## Out of scope (v2 — do not build)

`mode: runtime`, PR-comment GitHub Action, eslint-JSON context feeding, shared
rule sets, MCP server, interactive mode.
