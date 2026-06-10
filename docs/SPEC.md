# veto — Product & Technical Specification

> Status: **decided**. This document consolidates all product and architecture decisions.
> It is the source of truth for the initial implementation. Sections marked **v2** are
> explicitly out of scope for the first build.

---

## 1. The idea

A standalone CLI that runs **AI reviewer agents** against a repo's staged changes (as a
pre-commit gate, and later in CI/PRs) and reports structured findings.

Each reviewer is defined as **data** — a YAML file with a system prompt, natural-language
rules, and trigger globs — so the same engine reviews architecture, frontend conventions,
security, testing quality, etc., just by swapping configs. Configs live per-repo and are
committed; the engine is generic and installed as a dev dependency.

### The problem it solves

AI coding agents produce code faster than a human can review it. We need:

1. **Automated review** that runs without being asked (pre-commit, later CI).
2. **Observability** — a durable event log of what each reviewer did (ad-hoc "spawn
   parallel reviewer agents in Claude Code" failed precisely because there was no log).
3. **A standard interface for rules** reusable across all projects (personal and work):
   same engine everywhere, per-repo rule files.
4. **A closed feedback loop with the coding agent**: when the reviewer blocks a commit,
   the coding agent reads the findings and fixes them — the human reviews exceptions,
   not everything.

### Why build instead of buy (decided)

- CodeRabbit CLI / similar SaaS tools use **their own AI infrastructure** — no
  bring-your-own-model. We already pay for Claude; we want reviews to run on it.
- Since **June 15, 2026**, Claude subscription plans include a **monthly Agent SDK
  credit** (Pro $20, Max 5x $100, Max 20x $200) covering Agent SDK usage and `claude -p`,
  separate from interactive limits. The reviewer runs on this credit.
- **Critical consequence**: when the credit is exhausted (and usage credits are not
  enabled), Agent SDK requests **stop** until refresh. Therefore the gate **must fail
  open** (warn + exit 0) on any availability failure. Never block commits because the
  model is unreachable.
- The deltas we want that SaaS doesn't give us: multiple named reviewer personas,
  a local event log, an open config format, model independence.

---

## 2. Reviewer kinds (mode seam)

|              | **Static** (ships now)            | **Runtime** (v2, reserved)             |
|--------------|-----------------------------------|----------------------------------------|
| Input        | staged diff + repo files (text)   | the running app                         |
| Capability   | read-only tools                   | bash, Playwright/MCP, agentic loop      |
| Speed        | seconds                           | minutes                                 |
| Pre-commit   | yes                               | no (CI/PR only)                         |

The config carries `mode` as the seam. **Static grants no write/exec capability —
enforced in code, not by prompt** (see Restriction rings, §8). Runtime mode later is the
same engine with a different tool-permission policy function plus a `setup:` command.

---

## 3. How it is used

### Installation (per repo, decided: devDependency, not global)

```bash
npm i -D veto        # version pinned per repo, like eslint
```

### Pre-commit (husky)

```bash
# .husky/pre-commit
npx eslint --fix ...           # deterministic checks FIRST (cheap, exact)
npx veto .veto/ --staged
```

### CLI surface

```bash
veto --config=.veto/architect.yaml            # one reviewer
veto --config=a.yaml --config=b.yaml              # several
veto .veto/                                   # all configs in a dir
veto .veto/ --staged                          # staged diff only
veto ... --format=pretty|json                     # output format
veto ... --no-cache                               # bypass Layer 1 replay
```

### CLI subcommands

```bash
veto init            # scaffold .veto/ in the current repo
```

`veto init` onboards a repo without writing YAML by hand:

1. **Detects the stack** from `package.json` (`electron` > `next` > `react` >
   plain Node) to choose path globs and starter rules.
2. **Writes `.veto/architect.yaml`** — a commented starter config with the
   cost-tuned defaults (`model: claude-sonnet-4-6`, `effort: low`,
   `maxTurns: 8`, bounded-reading system prompt) and stack-shaped example
   rules the user is told to replace.
3. **Wires the hook**: appends `npx veto .veto/ --staged` to
   `.husky/pre-commit` when it exists (idempotent — skipped when already
   present); otherwise prints the line to add.
4. **Prints the agent-feedback snippet** for CLAUDE.md / AGENTS.md.

Exit 2 when not a git repo or `.veto/` already contains configs (no
clobbering; no `--force` in v1). Never runs the model — init is free and
offline.

### Exit codes & severity policy (decided)

| Code | Meaning |
|------|---------|
| 0    | no findings, or only `warning`/`info`, or **fail-open** (agent unavailable, timeout, parse failure after retry) |
| 1    | at least one `error`-severity finding → commit blocked |
| 2    | engine misuse (bad config, not a git repo, bad flags) |

Escape hatches when the reviewer is wrong: fingerprint suppression file (legitimate,
committed, see §6) and `git commit --no-verify` (emergency).

### Coding-agent feedback loop (decided)

The hook writes `.veto/runs/latest.json` on every run. The project's `CLAUDE.md`
contains one line:

> If a commit is blocked by the reviewer, read `.veto/runs/latest.json` and fix the
> findings, then commit again.

Files are more reliable than parsing hook stdout (which truncates/interleaves). Humans
get the same content as `.veto/runs/latest.md`, and the terminal output ends with a
pointer to it.

### Consumption surfaces (the engine's contract is *findings JSON + exit code*)

1. **Terminal / pre-commit**: blocks on `error` only; warnings print and pass.
2. **Coding agent**: reads `latest.json`, fixes, recommits (Layer 2 verifies resolution).
3. **PR comments (v2)**: a thin adapter (~100 lines) maps findings (`file`, `line`) onto
   the GitHub review-comments API from a GitHub Action. Note: Agent SDK credits are
   per-user and sized for individual use — team CI uses an `ANTHROPIC_API_KEY` instead.

---

## 4. Reviewer config (one YAML per reviewer, committed)

```yaml
# .veto/architect.yaml
name: architect
mode: static                  # "runtime" reserved in schema, rejected at runtime in v1
paths:                        # trigger globs — no staged match ⇒ reviewer doesn't run
  - "src/**/*.ts"
ignore:                       # never sent to / considered by this reviewer
  - "**/*.test.ts"
  - "**/generated/**"
  - "package-lock.json"
systemPrompt: |
  You are a software architect reviewing a staged diff before commit...
rules:                        # natural-language guidance the model interprets
  - keep domain logic out of UI components
  - id: no-cross-layer        # optional stable id (kebab-case, unique per config)
    rule: no cross-layer imports
  - new endpoints must not duplicate existing operations (search before flagging)
```

Design rules for configs:

- A rule is a plain string or `{id, rule}`. With an id, the prompt renders
  `[no-cross-layer] no cross-layer imports`, findings cite the **id** in their
  `rule` field (the structured-output schema constrains `rule` to an enum of the
  config's rule keys, so the backend validates the citation), and fingerprints
  hash the id — so rewording the rule text never breaks committed suppressions
  or the findings baseline. Plain rules keep citing their literal text.

- Rules are **judgment** rules only. If eslint could enforce it deterministically
  (naming, import boundaries, default exports), it does **not** belong here — it belongs
  in eslint (e.g. `eslint-plugin-boundaries`). Linters run first in the hook; the
  reviewer never re-litigates them. (v2: feed eslint JSON output into the reviewer's
  context so it knows what was already flagged.)
- Rules live per-repo. No shared/inheritable rule sets (non-goal for now).
- Editing a config changes review output even when not staged ⇒ config content is part
  of the Layer-1 cache key (§5).

### Suppressions (committed)

```
# .veto/ignore — one fingerprint per line, '#' comments allowed
a94f3c21e0b7  # architect: false positive about repository pattern in src/jobs/retry.ts
```

---

## 5. Memory across pre-commit re-runs (decided)

The loop is: commit → blocked → fix → commit again. The commit was never created, so
**HEAD does not move** during the loop. Natural session key:

```
key = (HEAD sha, branch, reviewer name)
```

When a commit finally succeeds, HEAD advances ⇒ memory expires automatically. Edge
cases: empty repo (no HEAD) → constant sentinel key; `--amend` keys on the amended
commit (acceptable).

**Every run is a fresh agent session.** We never resume SDK sessions: the baseline file
carries conclusions only (deterministic, cheap, decoupled from SDK session storage).
The full current staged diff is passed **every** run — the model must always see the code.

### Layer 1 — exact-replay cache (pure optimization)

`replayKey = hash(reviewer-scoped diff text + config file content on disk)`. Identical
key ⇒ replay stored findings, zero model calls, instant exit. The diff is hashed
**after** scoping to the reviewer's `paths`/`ignore` globs, so editing files outside a
reviewer's scope never invalidates its cache. Config content is hashed separately from
the diff because config edits don't appear in the staged diff unless staged.
`--no-cache` bypasses.

### Layer 2 — findings baseline (behavior change on re-run)

When the diff changed under the same key, the prompt receives, in addition to the
reviewer-scoped staged diff, the previous findings JSON plus this instruction
(verbatim intent):

1. For each previous finding, state whether it is now **resolved**.
2. Report **genuinely new** problems introduced by the modifications.
3. Do **not** raise new objections to code you previously reviewed and did not flag
   (no flip-flopping on previously accepted code).

Rule 2 means a fix that introduces a real new bug **is** flagged; rule 3 only forbids
inventing fresh complaints about unchanged, previously-accepted code. This is the main
defense against LLM-review whack-a-mole and the feature that makes a blocking gate
tolerable.

### Fingerprints (deterministic bookkeeping, no AI)

Computed by the wrapper: `fingerprint = sha1(reviewer + rule + file + normalizedSnippet)`
(normalize: strip whitespace/line numbers). Uses:

- match findings across re-runs (baseline resolution checking isn't prose comparison),
- human-driven suppression via `.veto/ignore` — engine drops suppressed findings
  before output, forever. The judgment is human; the fingerprint is just a stable handle.

---

## 6. Storage (decided: repo-local, self-gitignored)

All generated artifacts live in the repo, readable by human and agent alike. No global
directory.

```
.veto/
  architect.yaml                committed — config
  frontend.yaml                 committed — config
  ignore                        committed — fingerprint suppressions
  runs/                         generated — SELF-GITIGNORED
    .gitignore                  contains exactly "*"  (created by engine on first run)
    latest.json                 most recent findings, machine-readable (agent reads this)
    latest.md                   same content, human-readable
    <headSha>/<reviewer>/
      baseline.json             findings carried between attempts (Layer 2)
      record.json               run record: diffHash, attempt, sessionId, timings
      attempt-N.events.jsonl    full agent event stream (observability)
```

- The inner `.gitignore` with `*` makes the folder invisible to git regardless of the
  project's root ignore file. Zero setup; also makes writing during a hook safe
  (ignored files cannot leak into the commit). The engine never runs `git add`.
- **Pruning**: on each run keep only the last **10** HEAD keys; delete older ones.
- The reviewer agent's tool policy **denies reads into the runs dir** (the
  settings-provided directory, `.veto/runs/` by convention — its only legitimate
  memory is the injected baseline; don't let it wander into old transcripts).

---

## 7. Getting input (decided: deterministic wrapper, not the agent)

Two jobs, never given to the same party:

**Job 1 — collecting the staged diff: deterministic code.** The wrapper runs
`git diff --staged -U15` and `git diff --staged --name-only`, scopes the diff to the
reviewer's `paths`/`ignore` globs (per-file segments; a reviewer is only shown the
hunks it is meant to judge), and injects it into the prompt. The agent never "discovers" changes via git — nondeterministic, slow, and would
require exec capability. Partial-staging nuance: disk content can differ from staged
content (`git add -p`); when full staged file content is needed, use `git show :0:path`.

**Job 2 — repo knowledge: the agent's read-only tools.** The agent runs with `cwd` =
repo root and tools `Read`, `Grep`, `Glob` only. It investigates on its own: opens
surrounding files, greps for duplicate endpoints, reads `docs/adr/**`. This is the cheap
"holistic view" — no indexing infrastructure. Config `paths` tell it which staged files
are in its scope.

---

## 8. Restriction rings (decided: enforce in code, prompts are not law)

1. **Capability allowlist**: `allowedTools: ['Read', 'Grep', 'Glob']` for static mode.
2. **Resource ceiling**: `maxTurns` (default 15) + engine-side timeout (default 90 s,
   per reviewer) + abort signal.
3. **Per-call veto (the hard sandbox)**: the SDK's permission callback / `PreToolUse`
   hook runs a **pure policy function** over every tool call, deny-by-default:
   - reject any path that resolves outside the repo root,
   - reject reads into the settings-provided runs dir (`.veto/runs/` by convention),
   - (strict option) reject reads outside the reviewer's declared scope.
   `mode: runtime` later = a different policy function + wider allowlist, same engine.
   ⚠️ Verify the current SDK option name (`canUseTool` vs hooks config) against
   https://docs.claude.com/en/api/agent-sdk/overview — this API surface has moved.

---

## 9. Findings: the output contract

The model is instructed to end with strict JSON. The wrapper validates with Schema; on
decode failure it retries **once**, appending the schema error to the prompt ("your
output failed validation: …, emit only valid JSON"). Second failure ⇒ fail open.

```jsonc
// Finding
{
  "severity": "error" | "warning" | "info",
  "file": "src/api/users.ts",
  "line": 42,                      // nullable
  "rule": "no cross-layer imports",// which config rule triggered it
  "message": "UI component imports the repository directly...",
  "suggestion": "Route through the service layer ...",  // optional
  "fingerprint": "a94f3c21e0b7"    // computed by the WRAPPER, not the model
}

// latest.json (projection, overwritten every run)
{
  "ranAt": "2026-06-09T14:03:22Z",
  "head": "a1b2c3...", "branch": "feat/auth", "attempt": 3,
  "reviewers": [
    { "name": "architect", "status": "completed" | "replayed" | "skipped" | "unavailable",
      "findings": [ /* Finding[] after suppression filtering */ ],
      "resolved": [ /* fingerprints from baseline confirmed fixed */ ] }
  ],
  "blocking": true                  // any error-severity finding present
}
```

---

## 10. Architecture (decided)

### Principles

- **Functional core, imperative shell** — strict separation of **data** (Schema types),
  **calculations** (pure functions), and **actions** (effects at the edges).
- **Hexagonal**: the core depends only on **ports** (interfaces); adapters implement
  them. Tests swap adapters; the core never imports `node:*`, git, or the SDK.
- **Reactive & event-driven**: the agent is consumed as a `Stream` of events; the run's
  state is **a reducer over those events** (event sourcing). The JSONL event log is the
  source of truth; `record.json`, `baseline.json`, `latest.json`/`.md` are
  **projections** rebuilt from events.
- **CQRS**: commands mutate by appending events (`RunReview`); queries only read
  projections (`latest.json`, replay cache). The CLI is a thin command/query dispatcher.

### Data (Schema-defined, immutable)

`ReviewerConfig`, `StagedDiff`, `Finding`, `Baseline`, `RunRecord`, `SuppressionList`,
and the event union:

```ts
type ReviewEvent =
  | RunStarted        { key, attempt, diffHash, configHash }
  | ReviewerSkipped   { reviewer, reason: "no-matching-paths" }
  | ReplayServed      { reviewer }                     // Layer 1 hit
  | AgentEvent        { reviewer, raw }                // every SDK message, verbatim
  | ToolCallDenied    { reviewer, tool, path, reason } // policy vetoes
  | FindingsDecoded   { reviewer, findings }
  | FindingSuppressed { reviewer, fingerprint }
  | BaselineResolved  { reviewer, fingerprints }
  | ReviewerFailed    { reviewer, error, failOpen: true }
  | RunCompleted      { blocking }
```

`reduce(state, event) -> state` is a pure function; the final state yields exit code and
projections.

### Calculations (pure, the most-tested code)

glob matching (config `paths`/`ignore` × staged file list) · replay-key hashing ·
fingerprinting + snippet normalization · suppression filtering · baseline diffing
(resolved / persisting / new) · prompt building (systemPrompt + rules + diff + baseline
+ instructions) · the tool-call **policy function** (ring 3) · severity → exit code ·
the event reducer · projection renderers (JSON + markdown).

### Ports (interfaces) and adapters

| Port            | Methods (essence)                                  | Prod adapter                | Test adapter        |
|-----------------|----------------------------------------------------|-----------------------------|---------------------|
| `Git`           | stagedDiff, stagedFiles, head, branch, stagedFile  | CLI via `@effect/platform` `Command` | fixture     |
| `Agent`         | `run(prompt, policy, limits): Stream<AgentEvent>`  | `@anthropic-ai/claude-agent-sdk` `query()` wrapped with `Stream.fromAsyncIterable` | scripted stream, zero credits |
| `RunStore`      | appendEvent, readBaseline, writeProjections, prune | FileSystem under `.veto/runs/` | in-memory    |
| `Reporter`      | emit(projection, format)                           | terminal pretty / JSON      | collector           |
| `Clock`         | now                                                | system                      | fixed               |

### Pipeline per reviewer (shell)

```ts
runReviewer(cfg, diff) =
  agent.run(buildPrompt(cfg, diff, baseline), policy(cfg), limits).pipe(
    Stream.tap(runStore.appendEvent),          // event log as side channel
    Stream.runFold(initialState, reduce),      // state = reducer of events
    Effect.flatMap(decodeFindings),            // Schema, retry once w/ error appended
    Effect.timeout("90 seconds"),
    Effect.catchTags({
      AgentUnavailable: failOpen,              // credit exhausted / offline
      TimeoutException: failOpen,
      FindingsParseError: failOpen,            // after the one retry
    }),
  )

// all reviewers:
Effect.all(reviewers.map(runReviewer), { concurrency: 4 })   // latency ≈ slowest, not sum
```

Tagged errors: `GitError`, `ConfigError`, `AgentUnavailable`, `FindingsParseError`,
`TimeoutException`. The fail-open vs fail-closed distinction is **typed**, not try/catch.

---

## 11. Tech stack (decided)

| Concern        | Choice |
|----------------|--------|
| Language       | TypeScript, `strict`, ESM |
| Runtime        | Node ≥ 20 (SDK drives the `claude` CLI subprocess; do not target Bun) |
| Effect system  | `effect` (incl. `Schema`), `@effect/cli` (flags/subcommands/help), `@effect/platform` + `@effect/platform-node` (FileSystem, Path, Command) |
| Model          | `@anthropic-ai/claude-agent-sdk` — runs on the subscription's Agent SDK monthly credit locally; `ANTHROPIC_API_KEY` in CI |
| Parsing        | `yaml` → `Schema.decodeUnknown` |
| Globs          | `tinyglobby` (or `picomatch` for pure matching) |
| Tests          | `vitest` + `@effect/vitest`; property tests on reducer & fingerprint normalization welcome (`fast-check`) |
| Lint (own code)| `typescript-eslint` strict-type-checked + `eslint-plugin-functional` |
| Build/publish  | `tsup` → ESM bundle, `bin: { "veto": "dist/cli.js" }`, `engines.node >= 20` |

Schema sits at every trust boundary: YAML configs, model output, and our own files read
back from disk. Nothing untrusted crosses into the core undecoded.

---

## 12. End-to-end flow

```
pre-commit
  └─ eslint (deterministic, first)
  └─ veto .veto/ --staged
       1. load + decode configs            (ConfigLoader, Schema)
       2. git: staged diff, files, HEAD, branch
       3. per reviewer:
          a. glob match paths/ignore  → no match: ReviewerSkipped, exit fast
          b. replayKey hit?           → ReplayServed (Layer 1)
          c. load baseline for (HEAD, branch, reviewer)        (Layer 2)
          d. fresh agent session: full diff + baseline + rules
             read-only tools, policy veto, maxTurns, timeout
          e. decode findings (retry ×1) → fingerprint → filter suppressions
       4. fold events → state → projections:
          latest.json / latest.md / baseline.json / record.json ; prune to 10 HEADs
       5. print summary (+ pointer to latest.md)
       6. exit 1 iff any error-severity finding; fail open otherwise
```

---

## 13. Non-goals / deferred (v2+)

- `mode: runtime` (tool-using, app-driving reviewers) — schema reserved, rejected in v1.
- PR-comment adapter (GitHub Action) — design above, not in first build.
- Feeding eslint JSON into reviewer context.
- Shared/inheritable rule sets across repos; MCP server; interactive mode.

## 14. Acceptance criteria for v1

1. `npx veto .veto/ --staged` in a repo with one config reviews a staged
   diff and writes `latest.json`/`latest.md` + event JSONL.
2. Reviewer with non-matching `paths` adds < 100 ms and no model call.
3. Re-run with identical diff+config replays from cache (no model call).
4. Re-run after a fix: baseline injected; previously-accepted unchanged code is not
   re-flagged; resolved findings reported as resolved.
5. Fingerprint added to `.veto/ignore` permanently suppresses that finding.
6. Agent unavailable / timeout / double parse failure ⇒ warning + exit 0 (fail open).
7. An `error` finding ⇒ exit 1 and the commit is blocked; warnings alone ⇒ exit 0.
8. Tool-call policy: a `Read` outside repo root or into `.veto/runs/` is denied and
   logged as `ToolCallDenied`.
9. Whole engine testable with fixture adapters — full test suite spends zero credits.
