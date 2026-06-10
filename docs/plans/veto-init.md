# veto init

## Motivation

Onboarding a repo today is manual: write a YAML from scratch, wire the
hook, know the recommended cheap defaults. Setting up pluma by hand
(2026-06-10) took exactly the steps below — `veto init` automates them.

## Behavior

`veto init` in a git repo root:

1. **Detect the stack** from `package.json` (and obvious markers like
   `electron`, `react`, `next`, plain Node lib) to choose path globs and a
   starter persona.
2. **Write `.veto/<persona>.yaml`** — commented starter config with the
   cost-tuned defaults: `model: claude-sonnet-4-6`, `effort: low`,
   `maxTurns: 8`, bounded-reading system prompt ("read a file at most once,
   never read documentation — judge only the code"), and 3–5 stack-shaped
   judgment-rule examples the user is told to replace.
3. **Wire the hook**: if `.husky/pre-commit` exists, append
   `npx veto .veto/ --staged` (idempotent — skip when already present);
   otherwise print the line and where to put it.
4. **Print the agent-feedback snippet** for CLAUDE.md/AGENTS.md:
   "If a commit is blocked by the reviewer, read `.veto/runs/latest.json`,
   fix the findings, then commit again."

Exit 2 when not a git repo or `.veto/` already has configs (no clobbering;
`--force` not in v1). Never runs the model — init is free and offline.

## Steps

1. `src/cli/` subcommand via `@effect/cli` (`Command.make('init')` wired
   into the existing root command).
2. Pure core calculation: `package.json` text → detected stack → template
   data (no I/O in core).
3. Template rendering as data (string assembly in core; FileSystem writes
   in an adapter/shell).
4. Hook append with idempotency check.
5. Docs: README (Install/Usage), SPEC (new §CLI subcommands), FILES.md.
6. Tests: detection table, template snapshot per stack, idempotent hook
   append, refusal on existing configs / non-repo.
