# v1 acceptance walk (SPEC §14)

Every criterion is backed by an automated test (zero credits, fixture
adapters or an injected fake SDK query) and, where it matters, a manual
verification against the built `dist/cli.js` with the **real** Agent SDK.
Manual runs were performed on 2026-06-09 in a throwaway git repo containing
one `layering` reviewer config and a staged cross-layer import
(`src/ui/user-list.ts` importing `../db/users-table` directly).

## 1. End-to-end run writes projections + event log

> `npx veto .veto/ --staged` in a repo with one config reviews a staged
> diff and writes `latest.json`/`latest.md` + event JSONL.

- Tests: `test/cli/command.test.ts` — "reviews a staged diff, writes
  projections, and exits 0 when clean" (real temp git repo, fake query).
- Manual (real model): the run completed in ~16 s, reported the
  cross-layer import as an `error` finding with file/line/rule/suggestion,
  and wrote `latest.json`, `latest.md`,
  `<head>/layering/baseline.json`, `record.json`, and
  `attempt-1.events.jsonl` (~13 KB of agent events) plus the
  self-`.gitignore` containing `*`.

## 2. Non-matching reviewer: < 100 ms, no model call

- Tests: `test/engine/run-review.test.ts` — "scope skip (acceptance 2)":
  skipped status, `ReviewerSkipped` event, zero agent calls.
- Manual: with one always-skipping config the full CLI run averages
  ~1.30 s (node + Effect startup); adding a second non-matching reviewer
  moves the average to ~1.32 s — the marginal cost of a skipping reviewer
  is ~20 ms, with no model call.

## 3. Identical re-run replays from cache

- Tests: `test/engine/run-review.test.ts` — "Layer-1 replay
  (acceptance 3)": replayed status, one agent call across two runs,
  `--no-cache` bypass, config-edit cache bust.
- Manual (real model): immediate re-run after the blocking run finished in
  ~1.4 s, printed `layering: replayed` with the same finding, exited 1,
  and made no model call.

## 4. Re-run after a fix: baseline injected, resolution reported

- Tests: `test/engine/run-review.test.ts` — "Layer-2 baseline
  (acceptance 4)": previous findings + no-flip-flopping instructions in
  the prompt, resolved fingerprints in the projection.
- Manual (real model): after routing the import through a service layer
  and restaging, attempt 2 reported `completed, no findings` with
  `resolved: a4b4f2fdbe83` and exited 0.

## 5. Suppression file permanently drops a finding

- Tests: `test/engine/run-review.test.ts` — "suppressions
  (acceptance 5)" (filtered output, `FindingSuppressed` event, filtered
  baseline); `test/cli/prepare.test.ts` — ignore-file parsing.
- Manual (real model): adding the finding's fingerprint to
  `.veto/ignore` turned the replayed blocking run into
  `replayed, no findings`, exit 0, zero model calls — suppression applies
  on the replay path too.

## 6. Fail-open on unavailability / timeout / double parse failure

- Tests: `test/engine/run-review.test.ts` — "fail-open (acceptance 6)":
  unavailable agent → exit 0 + `ReviewerFailed { failOpen: true }`; parse
  failure retried once then fail-open; retry recovery; timeout fail-open;
  no record/baseline persisted on failure (a failed run never feeds the
  replay cache).

## 7. Exit codes: error blocks, warnings pass

- Tests: `test/engine/run-review.test.ts` (exit 1 on error finding,
  exit 0 on warnings only), `test/cli/command.test.ts` (same through the
  CLI, plus exit 2 misuse: not a repo, missing config, no targets,
  invalid flag), `test/core/exit-code.test.ts` (severity mapping).
- Manual (real model): blocking run exited 1; post-fix run exited 0;
  skip-only run in this repo exited 0.

## 8. Tool-call policy denies escapes and logs them

- Tests: `test/core/tool-policy.test.ts` (allowlist, repo-root
  containment, `.veto/runs/` denial, strict scope);
  `test/engine/run-review.test.ts` — "tool-call policy (acceptance 8)"
  (`ToolCallDenied` events for `../outside.txt` and
  `.veto/runs/latest.json`); `test/adapters/sdk-agent.test.ts`
  (the policy wired through the SDK's `canUseTool`, denials interleaved
  into the stream).

## 9. Whole engine testable with zero credits

- The entire suite (42 files, 231 tests) runs on fixture adapters
  (`test/adapters/`) and an injected fake `queryFn` for the SDK adapter
  and CLI tests. No test invokes the real Agent SDK; `npm run check`
  spends zero credits.

## Quality-gate audit (Phase 8)

- Tests: 231 passing across 42 files.
- Line coverage: 99.2 % (threshold 80 %).
- Type coverage: 99.94 % (threshold 95 %).
- Lint and typecheck clean; all gates enforced by `.husky/pre-commit`,
  which now also builds and dogfoods `veto` itself against this repo's
  `.veto/architect.yaml`.
