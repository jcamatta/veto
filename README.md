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
npm i -D veto        # per repo, version pinned, like eslint
```

Requires Node >= 20 and a git repository.

Then scaffold the repo in one step:

```bash
npx veto init        # detect the stack, write a starter .veto/architect.yaml, wire husky
```

`veto init` detects your stack from `package.json` (electron / next / react /
plain Node), writes a commented starter config with cost-tuned defaults and
example rules to replace, appends `npx veto .veto/ --staged` to
`.husky/pre-commit` when one exists (idempotently), and prints the
agent-feedback snippet for your CLAUDE.md. It refuses to overwrite existing
configs and never calls the model.

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
```

### Pre-commit (husky)

Deterministic checks first — linters are cheaper and exact; the reviewer
never re-litigates them:

```bash
# .husky/pre-commit
npx eslint .
npx veto .veto/ --staged
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0    | no findings, or only `warning`/`info`, or fail-open (agent unavailable, timeout, parse failure after retry) |
| 1    | at least one `error`-severity finding — commit blocked |
| 2    | engine misuse (bad config, not a git repo, bad flags) |

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
    rule: no cross-layer imports
  - new endpoints must not duplicate existing operations (search before flagging)
```

Keep **judgment** rules only. If eslint can enforce it deterministically, it
belongs in eslint, which runs first in the hook.

Give rules an `id` when you expect to reword them: findings cite the id
(enforced by the structured-output schema), and suppression fingerprints
hash the id — so editing the rule text never invalidates `.veto/ignore`
entries or the findings baseline.

On a personal subscription, `model: claude-sonnet-4-6` with `effort: medium`
is the recommended default — cheaper, faster, and far less likely to spend
its whole timeout thinking. The `model` string is opaque to the engine: only
the agent adapter interprets it, so alternative backends can define their
own values.

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

See [docs/SPEC.md](docs/SPEC.md) for the full specification,
[docs/PLAN.md](docs/PLAN.md) for the implementation plan, and
[docs/FILES.md](docs/FILES.md) for what every file is about.
