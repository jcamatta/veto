# Scoped diff per reviewer

## Motivation

`paths`/`ignore` only gate *triggering* today. The prompt embeds the entire
staged diff and the full file list — under a header that says "Staged files
in your scope". For a frontend reviewer scoped to `src/renderer/**` in a
commit that also touches `src/main/**`:

- **trust**: it can raise findings on backend code it was never meant to
  judge;
- **cost**: every out-of-scope hunk is a cache write in every reviewer's
  prompt — N reviewers pay N times;
- **cache stability**: `diffHash` covers the full diff, so editing an
  out-of-scope file invalidates a reviewer's replay cache even though
  nothing it reviews changed.

## Design

A pure calculation splits the unified diff into per-file segments
(`diff --git a/<old> b/<new>` headers; the new path identifies the segment)
and keeps only segments whose file survives `paths` minus `ignore` — the
same globs, via the existing `scopeFiles`. Unparseable segments and any
preamble are **kept** (fail-safe: never silently drop diff content). The
reviewer then receives a `StagedDiff` of only its hunks and only its files.

`diffHash` moves to the **scoped** diff text, so each reviewer's replay
cache survives out-of-scope edits. This changes existing cache keys once
(scoped text ≠ full text); the cache simply re-runs live on first use.

`strictScope` (tool policy) is unchanged — it bounds what the agent may
*read*; this plan bounds what it is *shown*.

## Steps

1. `src/core/diff-scope.ts` — `scopeDiff({ config, diff })`: segment split,
   glob filter, scoped `StagedDiff`; preamble/unparseable kept.
2. Engine: `runReviewer` computes the scoped diff once; `ReviewerRun` carries
   it; `dispatch` hashes it; `liveSession` prompts with it.
3. Docs: SPEC §5 (Layer-1 cache key = scoped diff + config), §7 (Job 1
   wording); FILES.md.
4. Tests: segment parsing (multi-file, renames, no-trailing-newline,
   preamble), filtering against paths/ignore, engine test that the prompt
   excludes out-of-scope hunks and that an out-of-scope edit replays from
   cache.
