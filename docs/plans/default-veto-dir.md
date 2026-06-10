# Default config discovery: bare `veto` finds `.veto/`

## Motivation

Today `veto --staged` with no config target exits 2 with "no reviewer
configs given: pass a config directory or --config". Every invocation must
spell out `.veto/` even though it is already the convention (`veto init`
scaffolds it, the dogfood hook uses it). Like eslint or prettier finding
their config, a bare `veto` run should default to `<repo-root>/.veto/` when
it exists — `npx veto --staged` just works.

## Behavior

- When **no positional dir and no `--config`** is given:
  - if `<repoRoot>/.veto` exists and is a directory → use it as the config
    target, exactly as if the user had typed `veto .veto/`.
  - otherwise → keep exit 2, but improve the `ConfigError` message to name
    the default and the bootstrap path, e.g.
    `no reviewer configs found: no .veto/ in the repo root — run veto init,
    pass a config directory, or use --config`.
- Explicit targets always win; the default is only consulted when the
  target list is empty. `veto init` still refuses when `.veto/` has configs
  (unchanged).
- An existing-but-empty `.veto/` directory falls through to the config
  loader, which already fails with a clear `ConfigError` ("no yaml configs
  in directory") → exit 2. No new behavior needed there.

## Implementation notes (for a cold start)

- The empty-target failure lives in `targetsOf` in `src/cli/prepare.ts`
  (`PrepareInput` already carries `repoRoot`, and `prepare` already has
  `FileSystem`/`Path` in `PrepareEnv`). Replace the hard failure with: stat
  `path.join(repoRoot, '.veto')`; directory → succeed with that as the
  single target; otherwise fail with the improved message.
- Keep the function single-purpose: a small `defaultTarget(env)(repoRoot)`
  helper next to `targetsOf` is cleaner than growing `targetsOf` past the
  statement limits (`max-statements: 12`, `max-params: 1` — curry).
- The runs dir and `ignore` file are anchored on the first target
  (`baseDirOf`), so the default flows through with no further changes.
- No engine, core, or domain changes.

## Steps

- [ ] 1. `src/cli/prepare.ts`: default the empty target list to
  `<repoRoot>/.veto` when that directory exists; improved error otherwise.
- [ ] 2. Tests: `test/cli/prepare.test.ts` (default applied; explicit
  targets win; improved error without `.veto/`) and
  `test/cli/command.test.ts` e2e (bare `veto --staged` reviews using
  `.veto/`; exit 2 in a repo without `.veto/`).
- [ ] 3. Docs: README Usage (`npx veto --staged` as the short form),
  SPEC §3 CLI surface, FILES.md descriptions touched by the change.
- [ ] 4. Optional polish, same branch: `veto init` and the README hook line
  can advertise the short `npx veto --staged` form (keep `.veto/` in the
  hook line if explicitness is preferred — decide in review).
