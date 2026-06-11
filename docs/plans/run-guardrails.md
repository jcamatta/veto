# Run guardrails — cancellation and cost ceilings

## Motivation

On 2026-06-11 a merge commit triggered a pre-commit review of the entire
incoming diff (68 files, ~2,550 insertions): 7 turns, 196 s, $0.80, and no
way to stop it once started. Three gaps compound into real money risk:

1. **No cancellation.** Ctrl-C during the husky hook does not reliably
   interrupt the SDK agent session; the run continues to completion (or the
   240 s timeout) regardless. A runaway review cannot be killed.
2. **No spend ceiling.** The only bounds are `timeoutMs` and `maxTurns`.
   Nothing watches the SDK's per-message cost; a slow expensive model can
   spend the whole timeout burning credit.
3. **No diff-size guard.** A huge staged diff (merges, vendored code,
   generated files) is sent to the model wholesale. Merge commits re-review
   code already gated on its own branches.

Without these, veto cannot be trusted in a pre-commit hook — exactly where
it must live. Fail-open philosophy applies throughout: every guardrail
aborts the review and lets the commit proceed with a visible warning;
guardrails must never block a commit by themselves.

## Steps

1. **Cancellation.** Wire SIGINT/SIGTERM to Effect fiber interruption in
   the CLI shell (`src/cli.ts` runtime): interruption must abort the SDK
   `query` (the SDK supports an `AbortController`; the adapter passes one
   and aborts it on interrupt). Emit a `RunAborted`-style event, report
   "aborted by user", exit 0 (fail open). Verify Ctrl-C works through
   husky on Windows (git bash) and POSIX shells; document any caveat.
2. **Cost ceiling.** New optional `maxCostUsd` (per reviewer config +
   `--max-cost-usd` run flag; reviewer overrides run, like `timeoutMs`).
   The engine accumulates cost from SDK stream messages and interrupts the
   session when the ceiling is crossed; outcome is a fail-open
   `ReviewerFailed` with reason `cost-ceiling`, surfaced in pretty/json
   output and `latest.md`.
3. **Diff-size guard.** New optional `maxDiffLines` / `maxDiffFiles` on
   the reviewer config (applied to the scoped diff, after paths/ignore).
   Exceeding either skips that reviewer before any model call, with a
   visible "diff too large — skipped" line. Conservative defaults
   (e.g. 3,000 lines / 50 files) in the init starter template, commented.
4. **Merge-commit skip.** `veto init` writes the hook line guarded so
   merge commits skip the review (`MERGE_HEAD` present ⇒ skip); apply the
   same guard to this repo's `.husky/pre-commit`.
5. **Docs.** SPEC §3 (flags/config), §6 (fail-open table gains
   `aborted` / `cost-ceiling` / `diff-too-large` reasons); README (new
   knobs, kill behavior, merge skip).
6. **Tests.** Interrupt mid-stream via the scripted agent (abort signal
   observed, fail-open exit 0); cost accumulation crossing the ceiling
   mid-stream; diff-size skip before any agent call; init template renders
   the guarded hook line; config decode for the new optional fields.
