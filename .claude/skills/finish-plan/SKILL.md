---
name: finish-plan
description: Close out a completed plan — verify it's done, run the checks, prove the change works (via the test-functionality skill), remove the plan file, push the branch, and open a PR whose body is the review artifact. Use when the user says a plan/feature is finished, asks to "finish the plan", "open the PR", "wrap up", or otherwise signals the branch is ready for review and approval.
---

# Finish a plan and open its PR

This skill runs the closing sequence for a completed plan. The workflow is:
work happens on a branch, commits accumulate through the plan, and when the
plan is **done** the branch is pushed and a PR is opened for the user to
review and approve. **The PR body is the primary review artifact** — the
user validates the work from the body, not by re-deriving it from the diff.
Everything below is in service of making that body trustworthy. You produce
the PR; the user gives final approval. Do not merge.

## 0. Preconditions — stop if any fail

Check these first and stop with a clear message if one isn't met:

- **On a feature branch, not a trunk branch.** Run
  `git rev-parse --abbrev-ref HEAD`. If it's `main`/`master`/`develop`,
  stop — there is nothing to PR from a trunk branch.
- **The plan is actually done.** Open the plan file in `docs/plans/`. Every
  step must be checked off and shipped, with no open/deferred items left to
  pick up. If anything is unfinished, stop and tell the user what remains.
- **Working tree is clean** (everything committed). Run
  `git status --short`. If there are uncommitted changes, stop and ask.

## 1. Verify the checks are green

Run the definition-of-done checks and report each result:

- `npm run lint`
- `npm run test`
- `npm run type-coverage`
- `npm run build`

If any fails, **stop** — the plan is not finishable until they pass. Do not
open a PR over red checks.

## 2. Prove the change works (test-functionality skill)

Invoke the `test-functionality` skill
(`.claude/skills/test-functionality/SKILL.md`). It exercises the actual
change — the built CLI against a fixture repo, or Playwright against a UI —
and returns a `## Proof it works` evidence report with real transcripts and
a final `Evidence verdict` line.

- If the verdict is **FAIL**, stop: the plan is not finishable. Report the
  failing behaviors to the user instead of opening the PR.
- If the verdict is **PASS**, keep the report verbatim — it goes into the
  PR body in step 3.

## 3. Draft the PR body (from the plan, before deleting it)

The plan file is the raw material — read it now, while it still exists,
plus the branch's commits (`git log main..HEAD --oneline`) and the diff
stat (`git diff --stat main...HEAD`). The body has these sections, in this
order:

1. **What was done** — the feature delivered, in product terms.
2. **Plan conformance** — one line per plan step, each marked:
   - ✅ *as planned*
   - ⚠️ *deviation* — what changed and why
   - ⏸️ *intentionally deferred* — why, and where it's tracked
   Then a final list: **Built but not in the plan** — anything delivered
   that the plan never asked for (or "nothing").
3. **Risk flags** — go through every item; name the risk or state "none"
   explicitly (never omit a row):
   - Schema / data-format / migration changes — if any: reversible? data
     loss possible? lock or downtime risk?
   - Infra / config / hook changes (CI, husky, build, scripts)
   - Auth, permissions, or secrets touched
   - New external dependencies (and why each is justified)
   - New endpoints, commands, or flags exposed to users
   - New failure modes that could block a user's commit (veto-specific:
     can this change make the gate reject things it shouldn't?)
4. **Business rules** — only if the plan involved domain rules; otherwise
   omit the section. A table: rule stated in domain language → where
   enforced (`file:line`) → test that covers it. The reviewer checks the
   rule statements are correct and trusts the pre-commit gate that the
   tests are real.
5. **Proof it works** — the evidence report from step 2, verbatim: real
   commands, real captured output, per-behavior verdicts. Not instructions
   for the user to follow — proof you already followed them.
6. **Files** — the key files this change adds/changes and what each is
   for, grouped by area.
7. **Tests** — what was tested and at which level (unit/use-case,
   integration, e2e).
8. **Notes / open questions** — decisions made, anything deferred,
   anything the reviewer should weigh.

Keep it factual and scannable. No attribution footers (the `commit-msg`
hook bans them, and the same applies to PR bodies per project convention).
Show the drafted title and body to the user before proceeding.

## 4. Remove the plan (its own commit)

Per the workflow, a completed plan is deleted — git keeps the history.
Delete the plan file and commit it **alone**:

```sh
git rm docs/plans/<name>.md
git commit -m "docs: remove plan <name>, complete"
```

## 5. Push the branch and open the PR

```sh
git push -u origin HEAD
gh pr create --base main --title "<conventional-commit-style title>" --body-file <tmp-body-file>
```

Write the body to a temporary file and pass `--body-file` — inline
`--body` strings get mangled by shell quoting (PowerShell especially).
Delete the temp file after the PR is created.

If the evidence included screenshots, they were committed under
`docs/pr-evidence/` and ship with the branch; link them from the body with
repo-relative paths.

**If `gh` is not authenticated** (`gh auth status` fails) or
`gh pr create` errors: do **not** treat it as done. Tell the user to run
`gh auth login`, and in the meantime **print the full PR title and body**
so they can paste it into the GitHub "compare & pull request" page for the
branch. Report the branch name and the compare URL.

## 6. Report

Tell the user: the branch name, the PR URL (or the paste-ready body if
`gh` wasn't available), the evidence verdict, that the plan file was
removed, and that the checks passed. Then **stop — the user reviews and
gives final approval.** Do not merge the PR yourself.
