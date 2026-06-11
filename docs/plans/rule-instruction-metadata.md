# rule-instruction-metadata — `instruction` field, `enabled`, per-rule scope

Branch: `feat/rule-instruction-metadata`

## Motivation

Rules are the judgment briefing handed to the reviewing agent, and the field
name should say so: `rule: { id, rule }` stutters and reads as a matcher;
`{ id, instruction }` tells the author they are writing for an agent that
applies the text literally to a diff. Long-form instructions (statement +
rationale + edge cases) are the intended style.

Two deterministic knobs ride along, per the guardrail in issue #6 (the
author owns where/on-off; the model owns only did-it-violate):

- `enabled: false` — park a rule without deleting it; its id (and therefore
  existing `.veto/ignore` fingerprints) survives.
- per-rule `paths` / `ignore` — a rule applies to a file iff the file is in
  the reviewer's scope AND the rule's scope (intersection; per-rule globs
  can only narrow, never escape).

Deliberately deferred (recorded so it is not re-litigated): per-rule
`severity` (floor semantics if it ever comes — decision waits on rule-stats
evidence that model-emitted severities misbehave), structured
`examples`/`guidance` buckets, inline `// veto-disable`, `extends`.

## Design

Schema (`IdentifiedRule`):

```yaml
rules:
  - id: tenant-id-every-query
    instruction: |
      Every repository query must include the tenant id...
    enabled: true            # optional, default true
    paths: ["src/modules/**"] # optional, default: reviewer scope
    ignore: ["**/*.spec.ts"]  # optional, default: []
```

- Back-compat: `rule:` is still accepted and decoded into `instruction`
  (Schema transform); bare-string rules unchanged. Docs use `instruction`
  only.
- Disabled rules: excluded from the prompt, from the findings-schema rule
  enum, and from `ruleKeys`; id uniqueness still enforced across the whole
  list.
- Scope semantics: when assembling the prompt for the reviewer's scoped
  diff, a rule is rendered only if at least one in-scope file matches the
  rule's globs; the per-file rule applicability is also used as a
  deterministic guard — a decoded finding citing rule X on a file outside
  X's scope is dropped (with an event, so it is visible, not silent).

## Steps

1. Schema: `instruction` with `rule` back-compat transform, `enabled`,
   `paths`/`ignore` on `IdentifiedRule`; decode tests incl. YAML
   round-trips and the back-compat path
   (`src/domain/reviewer-config.ts`, `test/domain/reviewer-config.test.ts`).
2. `src/core/rules.ts` — `ruleText` reads `instruction`; new projections:
   `enabledRules`, and `ruleAppliesTo` (rule × file → boolean, reusing
   picomatch via the existing glob-scope patterns; new file
   `src/core/rule-scope.ts` if rules.ts would exceed limits); unit tests.
3. Prompt assembly: `buildPrompt` renders only enabled rules that match at
   least one in-scope file (it already receives the scoped file list);
   `findingsSchemaFor` enum from the same filtered set; tests.
4. Finding guard: in `src/engine/reviewer-conclude.ts`, drop findings whose
   cited rule does not apply to the finding's file; emit a dedicated event
   (extend `ReviewEvent` only if a new variant is required — prefer reusing
   `FindingSuppressed` semantics with a distinct reason field only if that
   stays within its schema; otherwise new `FindingOutOfScope` variant +
   reducer case + tests).
5. Starter template: `renderStarterConfig` switches placeholder rules to
   `instruction` and adds a comment line stating the briefing discipline
   ("each instruction is read by a reviewing agent with your diff and
   nothing else — write it so a stranger could apply it without asking");
   template tests.
6. README config-format section + FILES.md.

## File ownership

New: `src/core/rule-scope.ts` (+ test).
Edited: `src/domain/reviewer-config.ts`, `src/core/rules.ts`,
`src/core/prompt.ts`, `src/core/findings-schema.ts`,
`src/engine/reviewer-conclude.ts` (+ possibly `src/domain/review-event.ts`,
`src/core/reducer.ts`), `src/core/init-template.ts`, matching tests,
`README.md`, `docs/FILES.md`.

## Parallel-work notes

- Does NOT touch `src/core/exit-code.ts`, `src/engine/run-review.ts`,
  `src/cli/**` — disjoint from the fail-on and schema/stats plans.
- `src/core/init-template.ts` is also touched by config-json-schema
  (modeline first line) — different lines, trivial conflict.
- If `review-event.ts`/`reducer.ts` gain a variant, rule-stats reads events
  but only existing variants — no conflict, but merge this plan before
  rule-stats if stats should also count out-of-scope drops (optional,
  stated there).
- No chronological dependency.
