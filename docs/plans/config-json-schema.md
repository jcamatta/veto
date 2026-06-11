# config-json-schema — generated JSON Schema, `veto check`, editor wiring

Branch: `feat/config-json-schema`

## Motivation

Reviewer configs are hand-written YAML validated only when a review actually
runs. Authors get no feedback while editing and no cheap way to validate all
configs in CI. `ReviewerConfig` is already an Effect `Schema`, so a standard
JSON Schema can be generated from it for free (`JSONSchema.make`) and wired
into editors via the `yaml-language-server` modeline. A `veto check` command
gives the same validation headlessly.

Out of scope: a manual `version:` field (already rejected in the rule-ids
plan — `configHash` covers config identity). The generated schema always
reflects whatever `ReviewerConfig` is at build time, so this plan needs no
coordination with plans that change the config shape — after merge, the
output updates by itself.

## Design

- `veto schema` — prints the JSON Schema for `ReviewerConfig` to stdout.
- `veto check [targets…]` — discovers configs exactly like a run does
  (positional / `--config` / `.veto/` default), decodes each, prints
  per-file ok/error, exits 0 when all decode, 2 otherwise. No git diff, no
  agent, no credits.
- `veto init` additionally writes `.veto/schema.json` and the starter
  template gains a first line
  `# yaml-language-server: $schema=./schema.json` so VS Code's YAML
  extension validates and autocompletes immediately.

Custom filters (e.g. unique rule ids) do not translate to JSON Schema; the
editor catches structure, `veto check` catches everything. JSON Schema
caveats of `JSONSchema.make` (unsupported combinators) must fail the build
loudly, not silently emit `{}`.

## Steps

1. `src/core/config-json-schema.ts` — pure: `configJsonSchema` constant via
   `JSONSchema.make(ReviewerConfig)`, exported as a plain object; test
   asserts required fields, enum values, and that known optional knobs
   appear (`test/core/config-json-schema.test.ts`).
2. `src/cli/schema-command.ts` — the `schema` subcommand printing the
   JSON-stringified schema; wire into `makeCli`; CLI test.
3. `src/cli/check-command.ts` — the `check` subcommand: resolve targets via
   the same discovery rules as `prepare` but **do not import or modify**
   `src/cli/prepare.ts` (conflict isolation) — use `config-loader` directly
   plus a small local target-resolution helper; per-file report; exit
   mapping; CLI tests (valid dir, malformed file, missing target).
4. `veto init` writes `.veto/schema.json`; `renderStarterConfig` gains the
   modeline as its first line; update init tests.
5. README (`veto schema`, `veto check`, editor setup blurb) + FILES.md.

## File ownership

New: `src/core/config-json-schema.ts`, `src/cli/schema-command.ts`,
`src/cli/check-command.ts`, matching tests.
Edited: `src/cli/command.ts` (subcommand wiring), `src/core/init-template.ts`
(modeline line only), `src/cli/init-command.ts`, `README.md`,
`docs/FILES.md`.

## Parallel-work notes

- `src/cli/command.ts` is also edited by the rule-stats plan (both add a
  subcommand) — one-line trivial conflict.
- `src/core/init-template.ts` is also edited by rule-instruction-metadata
  (starter rules wording) — different lines, trivial conflict.
- `README.md` / `docs/FILES.md` are edited by every plan — expected, trivial.
- No chronological dependency on any other plan.
