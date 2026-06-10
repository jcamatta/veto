# Stable rule ids

## Motivation

Finding fingerprints hash `reviewer + finding.rule + file + message`, and
`finding.rule` is whatever text the model echoes back. Two consequences:

- rewording a rule changes every fingerprint, silently breaking the
  suppressions committed in `.veto/ignore`;
- the model may paraphrase the rule text, so the same finding can produce
  different fingerprints across runs — direct damage to the bench's
  finding-stability metric.

Stable ids also unlock per-rule analytics in the bench (which rules fire,
which are noisy, which never trigger and only cost prompt tokens).

A manual `version:` field on the config was considered and rejected: every
run already records `configHash` (exact, automatic, can't lie), and the
committed YAML's git history resolves any hash back to its text.

## Design

```yaml
rules:
  - id: process-boundary
    rule: renderer code must never import node or electron main-process APIs
  - plain string rules remain valid and behave exactly as today
```

- Prompt renders identified rules as `- [process-boundary] <text>` and
  instructs findings to cite the id in their `rule` field.
- The structured-output schema constrains `rule` to the enum of the
  reviewer's ids (plus the literal texts of any plain-string rules), so the
  SDK validates and retries — a paraphrased rule reference becomes
  impossible rather than unlikely.
- Fingerprints hash the id when present, surviving rule-text rewording.

## Steps

1. `ReviewerConfig.rules`: `Schema.Union(Schema.String, Schema.Struct({ id, rule }))`
   with id format validation (kebab-case, unique within a config).
2. Prompt builder: render `[id]` prefix; extend the JSON instruction to cite
   ids.
3. Output schema: per-reviewer enum on `rule` built from the config.
4. Fingerprint: use id when the finding's rule matches one.
5. Docs: SPEC §3 (config), §5 (prompt), §9 (schema); README example;
   FILES.md.
6. Tests: config decode (both shapes, duplicate-id rejection), prompt
   rendering, fingerprint stability under text rewording, schema enum.
7. Migrate `.veto/architect.yaml` (and pluma's) to identified rules.
