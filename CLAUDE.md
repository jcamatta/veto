# veto

A standalone CLI that runs AI reviewer agents against a repo's staged changes
(pre-commit gate) and reports structured findings. The full product & technical
specification is in [docs/SPEC.md](docs/SPEC.md) — it is the source of truth.
The phased implementation plan is in [docs/PLAN.md](docs/PLAN.md).

## Workflow rules

- Work proceeds phase by phase per docs/PLAN.md. Each phase ends with review.
- **Never commit without explicit user approval.**
- Solo project: commit directly to `main`. No branches, no PRs.
- Conventional Commits: `<type>(<scope>): <description>` — allowed types:
  `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
  `style`, `test`. Short, imperative, lowercase description; no trailing period;
  `!` for breaking changes. No `Co-authored-by` or other footers.
- If a commit is blocked by the reviewer, read `.reviewer/runs/latest.json`
  and fix the findings, then commit again.

## Code conventions (enforced by lint where possible)

- TypeScript `strict`, ESM, Node >= 20. Effect ecosystem (`effect`,
  `@effect/cli`, `@effect/platform`, `@effect/platform-node`).
- **One file === one responsibility.** Split rather than grow.
- **No `let`, no `var`** — only `const`. Extensive `readonly`. Everything
  immutable. No global mutable state, ever.
- Almost zero `throw`: use `Effect`, `Either`, or a local `Result<Ok, Err>`
  type (defined in-repo, no dependency).
- No `console.log`. Logging goes through `Effect.log` using the tap pattern
  (`Effect.tap(...)` / `Stream.tap(...)`).
- **No default exports. One export statement, at the end of the file.**
- No inline comments.
- Hard function limits (eslint, `src/**/*.{ts,tsx}`): `max-params: 1`,
  `max-lines-per-function: 75`, `max-lines: 250`, `max-statements: 12`,
  `max-depth: 3`, `complexity: 8`, `max-nested-callbacks: 3`,
  `max-classes-per-file: 1`. If a function breaks a limit, split it or
  create a new file.
- Architecture: functional core / imperative shell, hexagonal (ports &
  adapters), event-sourced run state (reducer over events). Core never
  imports `node:*`, git, or the SDK. `Schema` at every trust boundary.

## Quality gates

- Test coverage > 80% (vitest + @effect/vitest).
- Type coverage > 95% (`type-coverage`).
- Husky pre-commit runs lint, typecheck, tests, and both coverage gates.

## Documentation discipline

- [docs/FILES.md](docs/FILES.md) explains what every file in the repo is
  about. **Every time a file is added, edited, renamed, or deleted, update
  docs/FILES.md in the same change.** This is mandatory, not optional.
