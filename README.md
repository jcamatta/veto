# veto

AI reviewer agents for staged changes — a pre-commit gate with structured
findings.

veto runs one or more **reviewer personas** (defined as YAML data, committed
per repo) against the staged diff before a commit lands. Each reviewer is a
Claude agent with read-only access to the repo, judged against
natural-language rules. Findings come back as strict JSON, blocking the
commit only on `error` severity — and the engine **fails open**: if the
model is unreachable, times out, or returns garbage twice, the commit
proceeds with a warning.

Reviews run on the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview),
which drives the `claude` CLI you already have — **no API key needed**:
locally it runs on your Claude subscription's Agent SDK credit. Only CI
environments without a logged-in `claude` need an `ANTHROPIC_API_KEY`.

## Install

```bash
npm i -D @jcamatta/veto        # per repo, like eslint
```

The package name is scoped (`@jcamatta/veto`), but the binary it installs is
`veto` — so every command below is just `veto ...` (or `npx veto ...`).

Requires **Node >= 20** and a **git repository**.

> **Scope.** veto wires itself into a [husky](https://typicode.github.io/husky/)
> pre-commit hook, so today the install-and-init experience targets
> **JavaScript / TypeScript projects** (npm + husky). The review engine itself
> is language-agnostic — it reviews whatever is in the staged git diff — but the
> turnkey setup assumes a Node/husky repo.

## How it's meant to be used

veto is a **pre-commit gate**. The intended setup is three steps, run once per
repo:

```bash
# 1. install
npm i -D @jcamatta/veto

# 2. scaffold config + wire the pre-commit hook
npx veto init

# 3. commit as usual — every commit is now reviewed
git commit -m "feat: ..."
```

`veto init` does the wiring for you: it detects your stack from `package.json`
(electron / next / react / plain Node), writes a commented starter
`.veto/architect.yaml` with cost-tuned defaults and example rules to replace,
and **appends the review line to `.husky/pre-commit`** (idempotently) so commits
are gated from then on:

```bash
git rev-parse -q --verify MERGE_HEAD >/dev/null || npx veto .veto/ --staged
```

It only appends to an **existing** `.husky/pre-commit`; if you don't have husky
set up yet, init prints the exact line to add. It refuses to overwrite existing
configs and never calls the model.

From there the loop is automatic: you `git commit`, veto reviews the staged
diff, and the commit is **blocked only on `error`-severity findings**. Fix the
findings (or [suppress](#escape-hatches) a false positive) and commit again — or
`git commit --no-verify` to bypass in an emergency. The engine **fails open**:
if the model is unreachable, times out, or returns garbage twice, the commit
proceeds with a warning rather than blocking your work.

## Commands

| Command | What it does |
|---------|--------------|
| `veto [.veto/]` | **Run a review** of the staged diff against the configs (defaults to `<repo-root>/.veto/`). This is the command the pre-commit hook runs. |
| `veto init` | **Scaffold** `.veto/` for this repo: starter config, JSON Schema, and husky pre-commit wiring. |
| `veto check` | **Validate** reviewer configs without running a review — no git diff, no agent, no credits. CI-friendly. |
| `veto schema` | **Print** the reviewer-config JSON Schema to stdout (for editor integration). |
| `veto stats` | **Report** per-rule health (fired / suppressed / severities) from the retained run history. |

## Usage

```bash
veto init                                     # scaffold .veto/ for this repo
veto --staged                                 # short form: defaults to <repo-root>/.veto/
veto .veto/                                   # all configs in a dir
veto --config=.veto/architect.yaml            # one reviewer
veto --config=a.yaml --config=b.yaml              # several
veto .veto/ --staged                          # staged diff (the default; flag documents intent)
veto .veto/ --format=json                     # machine-readable output (default: pretty)
veto .veto/ --no-cache                        # bypass the exact-replay cache
veto .veto/ --timeout=240                     # per-reviewer timeout in seconds (default 90)
veto .veto/ --max-cost-usd=0.50               # abort a reviewer once its run cost crosses this (USD)
veto .veto/ --fail-on=warning                 # block on warnings too (default error; never = report-only)
veto check                                    # validate configs without running a review
veto check .veto/ --config=extra.yaml         # same target rules as a run
veto schema                                   # print the reviewer-config JSON Schema
veto stats                                    # per-rule health from the retained run history
veto stats --format=json                      # same, machine-readable
```

### Validating configs

`veto check` discovers configs exactly like a run does (positional targets,
repeated `--config`, or the `.veto/` default), decodes each file, and prints
a per-file `ok` / `error` line. It exits 0 when every config decodes and 2
otherwise — no git diff, no agent, no credits. Use it in CI to keep every
reviewer config valid.

### Editor validation

`veto init` writes the generated JSON Schema to `.veto/schema.json` and the
starter config opens with a modeline:

```yaml
# yaml-language-server: $schema=./schema.json
```

With the VS Code YAML extension (or any `yaml-language-server` client) you
get inline validation and autocompletion while editing reviewer configs.
`veto schema` prints the same schema to stdout if you want to wire it up
elsewhere. The schema covers structure; cross-field rules (like unique rule
ids) are caught by `veto check`.

### Pre-commit (husky)

Deterministic checks first — linters are cheaper and exact; the reviewer
never re-litigates them:

```bash
# .husky/pre-commit
npx eslint .
git rev-parse -q --verify MERGE_HEAD >/dev/null || npx veto .veto/ --staged
```

The `MERGE_HEAD` guard skips the review on merge commits: a merge's staged
diff is everything the merged branch brings in — code already reviewed on
its own branch — so re-reviewing it only burns credit. `veto init` writes
this guarded line for you.

### Exit codes

| Code | Meaning |
|------|---------|
| 0    | no finding at or above the `--fail-on` threshold, or fail-open (agent unavailable, timeout, parse failure after retry) |
| 1    | at least one finding at or above the `--fail-on` threshold — commit blocked |
| 2    | engine misuse (bad config, not a git repo, bad flags) |

`--fail-on` sets the lowest severity that blocks (`info < warning < error`);
the default `error` keeps the behavior above. `--fail-on=never` makes the run
report-only: findings are still written to `latest.json`, but findings never
fail the run (exit 2 misuse paths are unaffected).

## Reviewer config

One YAML file per reviewer, committed (conventionally under `.veto/`):

```yaml
# .veto/architect.yaml
name: architect
mode: static                  # "runtime" is reserved for v2 and rejected today
model: claude-sonnet-4-6      # optional — opaque string the backend interprets
effort: medium                # optional — low | medium | high | xhigh | max
maxTurns: 15                  # optional — agentic turn ceiling
timeoutMs: 240000             # optional — overrides the run timeout for this reviewer
maxCostUsd: 0.50              # optional — abort once run cost crosses this (USD)
maxDiffLines: 3000            # optional — skip the reviewer if the scoped diff is larger
maxDiffFiles: 50              # optional — skip the reviewer if more files are in scope
paths:                        # trigger globs — no staged match ⇒ reviewer skips
  - "src/**/*.ts"
ignore:                       # never considered by this reviewer
  - "**/*.test.ts"
  - "package-lock.json"
systemPrompt: |
  You are a software architect reviewing a staged diff before commit...
rules:                        # natural-language judgment rules
  - keep domain logic out of UI components
  - id: no-cross-layer        # optional stable id (kebab-case, unique)
    instruction: no cross-layer imports
  - id: tenant-id-every-query
    instruction: |            # long-form briefings are the intended style:
      Every repository query must include the tenant id. State the rule,
      its rationale, and the edge cases — the reviewing agent applies this
      text literally to the diff and nothing else.
    enabled: true             # optional — false parks the rule, id survives
    paths: ["src/modules/**"] # optional — narrows within the reviewer scope
    ignore: ["**/*.spec.ts"]  # optional — per-rule exclusions
  - new endpoints must not duplicate existing operations (search before flagging)
```

Keep **judgment** rules only. If eslint can enforce it deterministically, it
belongs in eslint, which runs first in the hook.

Each `instruction` is the briefing handed to the reviewing agent: it sees
your diff and that text, nothing else — write it so a stranger could apply
it without asking. The legacy `rule:` key is still accepted and decoded
into `instruction`.

Give rules an `id` when you expect to reword them: findings cite the id
(enforced by the structured-output schema), and suppression fingerprints
hash the id — so editing the rule text never invalidates `.veto/ignore`
entries or the findings baseline.

The deterministic knobs stay with the author: `enabled: false` parks a
rule without deleting it, and per-rule `paths`/`ignore` intersect with the
reviewer scope (they can only narrow it, never escape it). A rule is
rendered only when it applies to at least one in-scope staged file, the
findings schema only accepts the rendered rules, and a finding citing a
rule on a file outside that rule's scope is dropped with a visible
`FindingOutOfScope` event.

On a personal subscription, `model: claude-sonnet-4-6` with `effort: medium`
is the recommended default — cheaper, faster, and far less likely to spend
its whole timeout thinking. The `model` string is opaque to the engine: only
the agent adapter interprets it, so alternative backends can define their
own values.

### Spend guardrails

Reviews cost credit, so veto bounds spend three ways — all fail open (they
abort the review, never block the commit by themselves):

- **Diff-size skip** (`maxDiffLines` / `maxDiffFiles`): an oversized scoped
  diff skips the reviewer *before any model call*, reported as a
  `diff-too-large` skip. Large merges are the usual trigger; the
  `MERGE_HEAD` hook guard already skips merges entirely.
- **Cost ceiling** (`maxCostUsd`, or `--max-cost-usd` for a whole run): rides
  the Agent SDK's native USD budget, so the query stops mid-flight when the
  ceiling is crossed and the reviewer fails open with a clear reason.
- **Cancellation**: Ctrl-C (SIGINT) aborts the in-flight SDK query, so a
  runaway review can always be killed by hand.

## How it behaves on re-runs

The fix-and-recommit loop keeps memory keyed on `(HEAD, branch, reviewer)` —
it expires automatically when the commit finally lands:

- **Replay cache**: identical staged diff + identical config ⇒ stored
  findings are replayed instantly with zero model calls (`--no-cache`
  bypasses).
- **Findings baseline**: after a fix, the reviewer sees its previous
  findings and must say what is resolved, report genuinely new problems,
  and **not** raise fresh objections to previously-accepted unchanged code
  (no whack-a-mole).

## Tuning rules with `veto stats`

Judgment rules have empirical precision: the only way to know a rule is
noisy or dead is to measure it. `veto stats` folds the retained run history
(the last 10 heads — older runs are pruned) into a per-rule health table:

```
rule              fired  suppressed  error  warning  info  last seen
no-cross-layer       12           5      8        4     0  a94f3c2
keep-domain-pure      1           0      0        1     0  77b01ce
```

The tuning loop: a rule that fires constantly and gets mostly suppressed is
noisy — sharpen its wording or delete it; a rule that never fires may be
dead weight. `--format json` emits the same data machine-readable. The runs
dir is anchored the same way as a review (next to the configs; `.veto/` by
default).

## Escape hatches

When the reviewer is wrong:

- **Suppress a finding permanently**: copy its fingerprint into
  `.veto/ignore` (committed; `#` comments allowed):

  ```
  a94f3c21e0b7  # architect: false positive about repository pattern
  ```

- **Emergency bypass**: `git commit --no-verify`.

## Outputs

Everything lands under `.veto/runs/` (self-gitignored — the engine
writes a `.gitignore` containing `*` on first run):

```
.veto/runs/
  latest.json                 most recent findings, machine-readable
  latest.md                   same content, human-readable
  <headSha>/<reviewer>/
    baseline.json             findings carried between commit attempts
    record.json               diff/config hashes, attempt, timings
    attempt-N.events.jsonl    the full agent event stream (observability)
```

`latest.json` is the contract for coding agents: add one line to your
`CLAUDE.md` —

> If a commit is blocked by the reviewer, read `.veto/runs/latest.json`
> and fix the findings, then commit again.

## Sandboxing

Reviewers are restricted in code, not by prompt: read-only tools
(`Read`/`Grep`/`Glob`), a turn ceiling and a 90 s per-reviewer timeout, and
a per-call policy that denies any path outside the repo root or inside
`.veto/runs/`. Denials are logged as `ToolCallDenied` events.

## Development

```bash
npm run check      # lint + typecheck + tests with coverage + type coverage
npm run build      # tsup → dist/cli.js
```

See [docs/SPEC.md](docs/SPEC.md) for the full specification and
[docs/PLAN.md](docs/PLAN.md) for the implementation plan.
