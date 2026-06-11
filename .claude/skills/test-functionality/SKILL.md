---
name: test-functionality
description: Prove that the change on the current branch actually works by exercising it for real — run the built CLI against a fixture repo (or drive the UI with Playwright if one exists) and capture the evidence as a paste-ready transcript. Use before opening a PR, when the user asks to "prove it works", "test the functionality", or wants evidence beyond unit tests.
---

# Prove the change works (evidence, not instructions)

Unit tests prove the code matches the tests. This skill proves the *product*
works: you exercise the actual change the way a user would, and you capture
what happened. The output is an **evidence report** the caller (usually the
`finish-plan` skill) pastes into the PR body — so the reviewer verifies
evidence instead of exploring the feature for the first time themselves.

Never write "steps for the user to follow". You follow the steps yourself,
now, and attach what you observed.

## 1. Identify what to prove

Read the plan in `docs/plans/` (or the branch diff, `git diff main...HEAD`)
and list the observable behaviors this change introduces or alters — in
user terms ("`veto` now fails the commit when X", "the report includes Y"),
not code terms. Each behavior gets its own evidence entry. Include at least
one **negative case** when the change adds a gate or validation (show it
rejecting, not just accepting).

## 2. Exercise the change for real

Pick the harness that matches what changed:

- **CLI behavior (the normal case for veto):** build first (`npm run build`),
  then run the real binary (`node dist/cli.js …`) inside a **throwaway
  fixture repo** — create one under a temp directory with `git init`, seed
  files, and stage changes that trigger the behavior. Never run destructive
  experiments against this repo's own staged state.
- **Config/file outputs:** run the command, then show the relevant file
  content it produced (e.g. an excerpt of `.veto/runs/latest.json`).
- **UI surface (if the project ever grows one):** drive it with Playwright,
  capture screenshots of the new screens/states, and save them to
  `docs/pr-evidence/<branch-name>/`. Reference them from the report. (These
  files are temporary; the cleanup is the PR merge + a follow-up removal.)

If a behavior cannot be exercised end-to-end (e.g. it needs a live API key
that isn't configured), say so explicitly in the report and show the closest
real thing you *could* run — never fabricate output.

## 3. Produce the evidence report

Return a markdown section titled `## Proof it works` containing, per
behavior:

- **Behavior** — one line, in product terms.
- **Command(s) run** — the exact invocations, in a fenced block.
- **Observed output** — the real captured stdout/stderr and exit code,
  trimmed to the relevant part (note what was trimmed). Real transcripts
  only — paste what the terminal actually printed.
- **Verdict** — ✅ works as intended / ❌ does not (with what's wrong).
- Screenshot links if any were captured.

End with one line: `Evidence verdict: PASS` only if every behavior is ✅;
otherwise `Evidence verdict: FAIL — <summary>`. A FAIL means the change is
not ready: report the failures to the caller instead of polishing the
report around them.

## 4. Clean up

Remove any temp fixture repos you created. Leave `docs/pr-evidence/` files
in place (they ship with the PR); leave this repo's working tree exactly as
you found it (`git status --short` should match the before state).
