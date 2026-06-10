# veto benchmark harness

Measures the three product priorities of the reviewer — **cost**, **speed**,
**reliability** — against the real agent backend. This document is the design
contract for `npm run bench`; the implementation follows it.

Benchmarks call the real model and consume real subscription credit or API
budget. They are run **on demand only** — never in the pre-commit hook, never
in regular CI.

## Why

The pre-commit gate lives or dies on three numbers that unit tests cannot
measure:

- **cost per run** — dominated by cache writes and output (thinking) tokens,
  not visible input tokens (a 13-turn run pushed ~305k input-side tokens of
  which only 10 were billed at the full input rate).
- **wall time** — observed ≈ `turns × ~12 s`; 13–18 turns puts a single
  reviewer at ~3 minutes, which is unacceptable in a pre-commit.
- **trust** — a reviewer that raises different findings on the same diff, or
  blocks on noise, gets `--no-verify`'d out of existence.

Every knob we tune (`model`, `effort`, `maxTurns`, diff context width, prompt
wording) trades these against review quality. The bench produces the numbers
so tuning is measurement, not guessing.

## What is measured

All per-run metrics come from observability that already ships in
`latest.json` / `record.json` — the bench adds no new instrumentation, it
orchestrates runs and aggregates:

| Metric | Source | Priority it serves |
|---|---|---|
| `costUsd` | stats (SDK `total_cost_usd`) | cost |
| `inputTokens`, `outputTokens`, `cacheCreationTokens`, `cacheReadTokens` | stats | cost |
| `durationMs`, `turns`, `toolCalls` | stats | speed |
| `model` | stats (reported by the backend, not the config) | sanity |
| findings (fingerprints + severities) | `latest.json` | reliability |
| outcome (`completed` / `unavailable` / fail-open cause) | `latest.json` | reliability |
| `denials` | stats | sandbox sanity |

Derived per cell (fixture × config), over N repetitions:

- **p50 / max wall time** and **seconds per turn**
- **mean cost per run** and token breakdown
- **finding stability** — Jaccard similarity of the error-severity
  fingerprint sets across repetitions. 1.0 = the reviewer blocks on exactly
  the same things every time. This is the "random things" metric: anything
  meaningfully below 1.0 on `error` severity is a trust bug, regardless of
  how good the findings read individually.
- **fail-open rate** — runs that ended `unavailable` (timeout / agent error /
  parse failure), with cause.

## Method

1. **Fixtures** are committed patches under `bench/fixtures/`:
   - `small.patch` — 1 file, < 30 changed lines.
   - `medium.patch` — ~5 files, mixed src/test, ~150 lines. The budget
     anchor: this is the typical commit.
   - `large.patch` — ~20 files / large diff, the stress case.
   Each fixture ships with the reviewer config(s) under test so the run is
   fully reproducible from the repo alone.
2. **Isolation**: the harness creates a temporary git repo (or worktree),
   applies the patch, stages it, and runs the built CLI:
   `node dist/cli.js <config-dir> --staged --no-cache --format=json`.
   `--no-cache` bypasses the replay cache so every repetition is a live
   model run. (A separate cheap assertion verifies the replay path stays
   instant and model-free.)
3. **Matrix**: each bench cell is `fixture × config`, where config varies
   `model` (sonnet / haiku), `effort` (low / medium), and `maxTurns`
   (8 / 15). Default repetitions: **3** per cell. A full sweep is expensive —
   the default invocation runs only the recommended config on `medium`;
   the sweep is opt-in.
4. **Results** go two places:
   - a human table on stdout, one row per cell;
   - one JSON line per run appended to `bench/results.jsonl` (committed),
     carrying the full stats object, fixture id, config hash, veto version,
     and accounting fields (below). Drift across SDK upgrades, prompt edits,
     and model changes shows up as history in this file.

## Budgets (the executable contract)

Checked against the `medium` fixture with the recommended config
(`model: claude-sonnet-4-6`, `effort: medium`). The bench exits non-zero
when a budget is broken, so a regression is a red run, not a vibe:

| Budget | Target | Rationale |
|---|---|---|
| wall time, max of N reps | **≤ 60 s** | a pre-commit must not feel like CI; default engine timeout is 90 s and we want headroom, not fail-open |
| turns | **≤ 10** | wall time ≈ turns × 12 s; the turn ceiling is the wall-time lever |
| cost per run | **≤ $0.15** | a $0.50 review per commit is ~$10/day for an active dev on API billing |
| error-finding stability | **= 1.0** across reps | blocking findings must be deterministic-ish; warnings may vary |
| fail-open rate | **0** on small/medium | fail-open on a normal commit means the gate silently stopped gating |

Current reality (2026-06-10, two dogfood runs, this repo's architect config
with `effort: medium`, `maxTurns: 15`): 13–18 turns, 176–180 s, $0.35–0.51.
**Every speed/cost budget above is currently broken** — that is the point;
the first bench campaign tunes `maxTurns`, `effort`, and diff context (`-U15`
→ smaller) until the medium cell fits the budgets without killing finding
quality.

## Accounting — whose credit does a run burn?

Every agent session starts with an `init` message (persisted in
`attempt-N.events.jsonl`) whose `apiKeySource` field says how the run is
authenticated:

- **`"none"`** — no `ANTHROPIC_API_KEY` in the environment. The SDK drives
  the locally logged-in `claude` CLI, so the run draws from **that login's
  Claude subscription usage**. Which account that is, is whatever
  `claude /login` stored on the machine — the SDK does not expose the email;
  check locally with `claude` itself. All dogfood runs so far were
  `apiKeySource: "none"` (camatta's subscription).
- **`"user"` / `"project"` / `"org"` / `"temporary"`** — an API key was
  picked up from the environment/config; the run bills that key's
  organization per-token.

Two consequences the bench records per run:

1. `apiKeySource` is copied into each `results.jsonl` line, so historical
   numbers are attributable ("this slow cell ran on the subscription, that
   one on the CI key").
2. `costUsd` is the **API-equivalent price** computed by the SDK, and since
   2026-06-15 it is the literal billing unit everywhere: subscription plans
   draw Agent SDK / `claude -p` usage from a **monthly Agent SDK credit**
   measured in dollars ($20 Pro, $100 Max 5x, $200 Max 20x — separate from
   interactive limits, no rollover), and CI keys bill the same rates
   per-token. A $0.35 review × N commits/month is a budget line, not an
   abstraction. When the monthly credit is exhausted, SDK requests stop and
   veto **fails open** — the gate silently stops gating until the cycle
   resets, which is a reliability scenario the bench's fail-open metric
   should be read against.
   See https://support.claude.com/en/articles/15036540.

Harness TODO: `record.json` currently persists `sessionId: null`; the bench
should lift `session_id` and `apiKeySource` from the init event into its
results so no JSONL spelunking is needed.

## Reliability beyond the bench

Two reliability properties are deterministic and belong in vitest (free,
every pre-commit), not in the paid bench:

- **replay cache**: identical diff + config ⇒ findings served with zero
  agent calls, in milliseconds.
- **timeout fail-open**: a hung agent releases the commit at `timeoutMs`,
  never later.

The bench measures only what requires a live model: stability, fail-open
rate in practice, and the cost/speed envelope.

## Running

```bash
npm run build                       # bench drives dist/cli.js
npm run bench                       # recommended config, medium fixture, 3 reps
npm run bench -- --sweep            # full matrix (expensive, opt-in)
npm run bench -- --fixture=large    # one cell
```

Prerequisites: a logged-in `claude` CLI (or `ANTHROPIC_API_KEY` exported),
and the awareness that every invocation spends real credit.
