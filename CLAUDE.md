# veto

A standalone CLI that runs AI reviewer agents against a repo's staged changes
(pre-commit gate) and reports structured findings. The full product & technical
specification is in [docs/SPEC.md](docs/SPEC.md) — it is the source of truth.
The phased implementation plan is in [docs/PLAN.md](docs/PLAN.md).

## Workflow rules

- Work proceeds phase by phase per docs/PLAN.md. Each phase ends with review.
- **New features beyond the committed phases do not extend PLAN.md.** Each
  feature gets one design doc in `docs/plans/<feature>.md` (motivation +
  steps); implementation follows that doc step by step. Once the feature is
  fully implemented, the plan doc can be deleted.
- **Keep commits small.** The pre-commit enforces a size budget
  (`.husky/check-commit-size.sh`): ≤ 300 weighted source lines, ≤ 15 source
  files, and test changes required when > 30 source lines change. Split
  work into multiple commits rather than fighting the budget.
- **Every plan and every change gets its own branch** named per the
  [Conventional Branch spec](https://conventionalbranch.org):
  `<type>/<description>` with type drawn from the same list as commit
  types (`build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test` —
  `feat` not `feature`, `fix` not `bugfix`) and a lowercase
  hyphen-separated description. Direct commits to `main` are rejected by
  `.husky/check-branch.sh`.
- **A branch is associated with its plan.** When the plan is complete
  (including removing the plan doc), close it with the `finish-plan` skill
  (`.claude/skills/finish-plan/SKILL.md`): verify the checks, push the
  branch, and open a GitHub PR (`gh pr create`) with a structured
  description. The user reviews and merges the PR — never merge it yourself.
- Conventional Commits: `<type>(<scope>): <description>` — allowed types:
  `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
  `style`, `test`. Short, imperative, lowercase description; no trailing period;
  `!` for breaking changes. No `Co-authored-by` or other attribution footers.
  Both the format and the footer ban are enforced by `.husky/commit-msg`.
- If a commit is blocked by the reviewer, read `.veto/runs/latest.json`
  and fix the findings, then commit again.

## Releasing (npm)

Published to npm as the scoped, public package `@jcamatta/veto` (the binary
is still `veto`). There is **one release line — `main`** — and no per-version
branches. A "version" is a commit on `main` that bumps `package.json`, marked
by a git tag `vX.Y.Z`; the npm version, the `package.json` version, and the
tag always agree.

- **Bump type follows the conventional commits** since the last release:
  only `fix`/`perf`/`chore` ⇒ **patch**; any `feat` ⇒ **minor**; any `!`
  breaking change ⇒ **major**. While on `0.x` (unstable API), breaking
  changes bump the **minor**, not the major — `1.0.0` is the deliberate
  stable-API commitment.
- **Release procedure** (respects the no-direct-commits-to-`main` and
  conventional-`commit-msg` hooks):
  1. Branch `chore/release-vX.Y.Z`.
  2. `npm version X.Y.Z --no-git-tag-version` — bumps `package.json` only.
     Do **not** let `npm version` create the commit/tag: its default message
     is the bare number, which the `commit-msg` hook rejects.
  3. Commit `chore: release vX.Y.Z`, open a PR, the user merges it.
  4. **After merge**, on `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`,
     then `npm publish`. Tag *after* merge so the tag points at the actual
     `main` commit (a squash-merge rewrites the branch commit).
- `npm publish` needs `npm login`. It auto-runs `prepublishOnly`
  (`npm run check`) and `prepare` (rebuild `dist`), and `publishConfig`
  already sets public access — no `--access` flag, and a broken build can't
  ship. **The user runs `npm publish`** — never publish on their behalf.

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
