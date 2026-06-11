---
name: address-pr-review
description: Work through the review observations on the current branch's open PR — fix the ones that are right (committing per the repo rules), reply on the PR with reasoning for the ones that aren't, and push. Use when the user says "address the review", "handle the PR comments/observations", "fix the review findings", or after a PR opened with finish-plan received feedback.
---

# Address the review observations on this branch's PR

This skill is the worker counterpart to `finish-plan`: that skill opens the PR, this one processes the feedback it receives. You are acting as the agent that made the change, so you have the context to judge each observation. For every observation you either **fix it** or **push back on it in the PR** — never silently ignore one.

## 0. Preconditions — stop if any fail

- **On a feature branch with an open PR.** Run `git rev-parse --abbrev-ref HEAD`, then `gh pr view --json number,url,state,title`. If there is no PR for the branch or it is not `OPEN`, stop and say so.
- **Working tree is clean.** `git status --short`. Uncommitted work would get tangled with review fixes — stop and ask.
- **`gh` is authenticated.** If `gh auth status` fails, stop and tell the user to run `gh auth login`.

## 1. Collect every observation

Gather all three feedback channels (replace `<n>` with the PR number):

```sh
gh pr view <n> --json reviews,comments
gh api repos/{owner}/{repo}/pulls/<n>/comments   # inline review comments (file + line)
```

Build a flat list: each item has an id, author, file/line if inline, the text, and whether it already has a reply from you. **Skip items you already replied to or fixed in a previous run** (check the thread and `git log` since the comment's timestamp). If the list is empty, report that and stop.

## 2. Triage each observation

For each item, read the referenced code and decide honestly:

- **Valid** — the reviewer is right, or the fix is cheap and harmless: fix it.
- **Invalid / out of scope** — the observation misreads the code, contradicts the spec (`docs/SPEC.md` is the source of truth), conflicts with a repo convention in `CLAUDE.md`, or belongs in a separate plan: don't change code; respond on the PR instead.
- **Genuinely ambiguous** (a real design decision the user should make): don't guess — list it in the final report as a question for the user.

Do not be agreeable by default: a wrong observation gets a respectful, technically argued reply, not a code change. Equally, do not defend a real bug — fix it.

## 3. Apply the fixes

All repo rules still apply — small Conventional Commits, lint/test/coverage hooks, no lint suppressions (restructure instead).

- Group fixes into logical commits (one concern per commit, within the size budget). Use `fix:`/`refactor:`/`test:`/`docs:` as appropriate.
- If pre-commit is blocked by the veto reviewer, read `.veto/runs/latest.json`, fix the findings, and commit again.
- Run the full checks once at the end: `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build`. Do not push red.

## 4. Respond on the PR

Push first so replies can reference real commits:

```sh
git push
```

Then close the loop on every observation:

- **Fixed items** — reply in the thread with the commit hash and a one-line summary of the fix:
  ```sh
  gh api repos/{owner}/{repo}/pulls/<n>/comments/<comment-id>/replies -f body="Fixed in <hash>: <summary>"
  ```
- **Rejected items** — reply in the thread with the concrete reason: cite the spec section, the convention, or the code path that shows the observation doesn't hold. Keep it short, factual, and polite; invite the reviewer to re-raise if they disagree.
- **Non-inline feedback** (review summaries, plain PR comments) — answer with a single PR comment (`gh pr comment <n> --body "..."`) that addresses each point in order.

Do not resolve threads yourself and do not re-request review unless asked — the reviewer/user decides when a thread is settled.

## 5. Report

Tell the user: how many observations were found, which were fixed (with commit hashes), which were rejected and why (one line each), any ambiguous items that need their decision, and that the checks passed before pushing. Then stop — do not merge, do not approve.
