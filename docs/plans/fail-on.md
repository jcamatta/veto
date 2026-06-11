# fail-on — exit-code threshold over model-emitted severities

Branch: `feat/fail-on`

## Motivation

Today the exit code is fixed: any `error`-severity finding blocks
(`isBlocking` in `src/core/exit-code.ts`). Teams need to tune the gate
without touching rules: a strict CI lane that blocks on warnings, or an
advisory/report-only mode that never blocks. `--fail-on` is a pure exit-code
policy over severities the model already emits — no rule-shape change, fully
deterministic, ESLint-familiar.

This deliberately does NOT add per-rule `severity` (deferred — see
rule-instruction-metadata). The threshold compares against whatever severity
the model emitted per finding.

## Design

- CLI flag `--fail-on <level>` with `level ∈ error | warning | info | never`,
  default `error` (current behavior, zero surprises).
- Semantics: exit 1 iff any finding's severity ≥ threshold
  (`info < warning < error`); `never` → always exit 0 from findings (exit 2
  misuse paths unchanged). Fail-open reviewer failures keep their current
  exit behavior regardless of threshold.
- The threshold travels through `RunSettings` so the projection/report can
  state which policy produced the verdict (the `blocking` flag in
  `latest.json` must reflect the threshold actually applied, keeping report
  and exit code consistent).

## Steps

1. Domain: `FailOn` literal schema (`error|warning|info|never`) — new file
   `src/domain/fail-on.ts` + decode test (avoids editing files owned by
   other plans).
2. Core: severity ordering + `isBlocking` generalized to a curried
   `blocksAt(threshold)(findings)` in `src/core/exit-code.ts` (respecting
   `max-params: 1`); existing callers get `error`; exhaustive tests incl.
   `never`.
3. Projection: `buildProjection` derives `blocking` via the threshold from
   settings; `src/core/projection.ts` + tests.
4. CLI: `--fail-on` option in `src/cli/options.ts` (default `error`),
   carried via `src/cli/prepare.ts` into `RunSettings`
   (`src/engine/inputs.ts`); `src/engine/run-review.ts` derives the exit
   code with the threshold; options/prepare/engine tests + an end-to-end
   CLI test (`warning` findings: exit 0 by default, exit 1 with
   `--fail-on warning`; `never`: exit 0 with error findings).
5. README (flag, exit-code table) + FILES.md.

## File ownership

New: `src/domain/fail-on.ts` (+ test).
Edited: `src/core/exit-code.ts`, `src/core/projection.ts`,
`src/cli/options.ts`, `src/cli/prepare.ts`, `src/engine/inputs.ts`,
`src/engine/run-review.ts`, matching tests, `README.md`, `docs/FILES.md`.

## Parallel-work notes

- Disjoint from rule-instruction-metadata (no prompt/rules/schema files) and
  from config-json-schema (no subcommands; check-command deliberately does
  not import `prepare.ts`).
- `src/engine/run-review.ts` and `inputs.ts` are not touched by any other
  plan in this batch.
- No chronological dependency.
