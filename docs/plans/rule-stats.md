# rule-stats — per-rule health from run history (`veto stats`)

Branch: `feat/rule-stats`

## Motivation

veto's rules are judgments, so their precision is empirical: the only way to
know a rule is noisy (fires constantly, mostly suppressed) or dead (never
fires) is to measure it. Run history already exists as JSONL event logs in
the runs dir (`FindingsDecoded`, `FindingSuppressed`, `BaselineResolved` per
reviewer/head/attempt). `veto stats` aggregates it per rule id and prints a
health table — the evidence base for tuning instructions, parking rules
(`enabled: false`), and the deferred per-rule `severity` decision.

This is the feature ESLint cannot have and veto must: deterministic rules
don't need fire-rate telemetry; judgment rules do.

## Design

- `veto stats [targets…]` — resolves the runs dir the same way a run does
  (next to the configs; `.veto/` default), reads all retained head dirs,
  folds events into per-rule aggregates, prints a table:
  rule id (or the literal text for plain rules) × findings fired ×
  suppressed × severities emitted (count per level) × last seen (head).
  `--format json` mirrors the table as a Schema-encoded object.
- Pure aggregation lives in core (events in → stats out); reading is an
  additive `RunStore` capability; the command is thin.
- History is bounded by the existing prune (last 10 heads) — stated in the
  output so nobody mistakes it for all-time data.

## Steps

1. Port: extend `src/ports/run-store.ts` with read capabilities —
   `listHeads` and `readEvents(key, attempt)` (or a single
   `readAllEvents` stream if simpler) — additive only; implement in
   `src/adapters/fs-run-store.ts` (decode JSONL lines via the existing
   `ReviewEvent` schema, skip corrupt lines) and in
   `test/adapters/in-memory-run-store.ts`; adapter tests.
2. Core: `src/core/rule-stats.ts` — fold `ReviewEvent`s into
   `RuleStats` aggregates (fired / suppressed / severity histogram / last
   head); pure unit tests incl. unknown-rule and plain-string rules.
3. Core: `src/core/rule-stats-format.ts` — aggregates → the table text
   (one line per rule, aligned, prune-window note); render tests.
4. Domain: `RuleStats` schema for the json format —
   `src/domain/rule-stats.ts` + decode test.
5. CLI: `src/cli/stats-command.ts` — resolve runs dir (reuse the anchoring
   convention but do not modify `prepare.ts`; small local helper),
   wire `stats` subcommand into `makeCli`; CLI tests on a temp runs dir
   (events from a scripted run, empty history, corrupt lines skipped).
6. README (`veto stats`, the tuning loop: noisy rule → improve instruction
   or park it) + FILES.md.

## File ownership

New: `src/core/rule-stats.ts`, `src/core/rule-stats-format.ts`,
`src/domain/rule-stats.ts`, `src/cli/stats-command.ts`, matching tests.
Edited: `src/ports/run-store.ts`, `src/adapters/fs-run-store.ts`,
`test/adapters/in-memory-run-store.ts`, `src/cli/command.ts` (subcommand
wiring), `README.md`, `docs/FILES.md`.

## Parallel-work notes

- `src/cli/command.ts` is also edited by config-json-schema (both add a
  subcommand) — one-line trivial conflict.
- Reads only existing `ReviewEvent` variants; if rule-instruction-metadata
  adds an out-of-scope-finding variant, counting it here is a optional
  follow-up after both merge — not a dependency.
- No other plan touches `run-store` port/adapters.
- No chronological dependency.
