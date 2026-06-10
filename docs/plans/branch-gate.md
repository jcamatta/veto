# Conventional-branch commit gate

## Motivation

All work so far landed directly on `main`. From now on every plan and every
change gets its own branch named per the
[Conventional Branch spec](https://conventionalbranch.org/#specification),
and direct commits to `main` are rejected by a hook — `main` only moves by
merging a finished branch.

## Behavior

A new `.husky/check-branch.sh` runs first in the pre-commit hook (before the
expensive gates, so a wrong branch fails in milliseconds):

1. **Merge commits pass** (`MERGE_HEAD` present) — merging a branch into
   `main` is how work lands.
2. **Detached HEAD fails** — commits need a branch.
3. **`main` fails** — direct commits are rejected with the
   `git switch -c feature/<description>` hint.
4. **The branch name must match** `<type>/<description>` with type in
   `feature|feat|bugfix|fix|hotfix|release|chore` and a description of
   lowercase `a-z0-9` words separated by single hyphens (dots allowed for
   release version numbers); no leading/trailing/consecutive separators.

## Steps

1. `.husky/check-branch.sh` with the rules above; wire it as the first line
   of `.husky/pre-commit`.
2. CLAUDE.md: replace the commit-directly-to-main rule with the
   branch-per-change workflow (branch → gates → `merge --ff-only` → delete
   branch).
3. FILES.md entries; verify the gate passes on this branch and fails on
   `main`; merge.
