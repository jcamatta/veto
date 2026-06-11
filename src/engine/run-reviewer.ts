import { DateTime, Duration, Effect } from 'effect'
import { scopeDiff } from '../core/diff-scope.js'
import { findingsSchemaFor } from '../core/findings-schema.js'
import { configHash, diffHash } from '../core/hashing.js'
import { buildPrompt } from '../core/prompt.js'
import { activeRules } from '../core/rule-scope.js'
import { filterSuppressed } from '../core/suppression.js'
import { evaluateToolCall, type PolicyDecision } from '../core/tool-policy.js'
import type { Baseline } from '../domain/baseline.js'
import {
  FindingsDecoded,
  FindingSuppressed,
  ReplayServed,
  ReviewerFailed,
  ReviewerSkipped,
  type ReviewEvent
} from '../domain/review-event.js'
import type { RunKey } from '../domain/run-key.js'
import type { RunRecord } from '../domain/run-record.js'
import type { StagedDiff } from '../domain/staged-diff.js'
import { Agent, type ToolCallRequest } from '../ports/agent.js'
import { ReviewClock } from '../ports/clock.js'
import { RunStore } from '../ports/run-store.js'
import { runSession } from './agent-session.js'
import type { ReviewContext, ReviewerSource } from './inputs.js'
import { conclude, fingerprinted } from './reviewer-conclude.js'
import {
  appendEvents,
  startedEvent,
  type ReviewerRun
} from './reviewer-run.js'

type ReplayCheck = {
  readonly record: RunRecord | null
  readonly diffHash: string
  readonly configHash: string
  readonly noCache: boolean
}

type Dispatch = {
  readonly ctx: ReviewContext
  readonly reviewer: ReviewerSource
  readonly key: RunKey
  readonly record: RunRecord | null
  readonly baseline: Baseline | null
  readonly diff: StagedDiff
}


type LiveSession = {
  readonly run: ReviewerRun
  readonly startedAt: DateTime.Utc
}

type FailOpen = {
  readonly run: ReviewerRun
  readonly started: ReviewEvent
}

const defaultMaxTurns = 15

const policyFor =
  (run: ReviewerRun) =>
  (call: ToolCallRequest): PolicyDecision =>
    evaluateToolCall({
      repoRoot: run.ctx.settings.repoRoot,
      runsDir: run.ctx.settings.runsDir,
      tool: call.tool,
      path: call.path,
      scope: run.ctx.settings.strictScope ? run.reviewer.config.paths : null
    })

type Skip = {
  readonly key: RunKey
  readonly reason: 'no-matching-paths' | 'no-active-rules'
}

const skipped = ({
  key,
  reason
}: Skip): Effect.Effect<readonly ReviewEvent[], never, RunStore> =>
  appendEvents({
    key,
    attempt: 1,
    events: [ReviewerSkipped.make({ reviewer: key.reviewer, reason })]
  })

const replay = (
  run: ReviewerRun
): Effect.Effect<readonly ReviewEvent[], never, RunStore> => {
  const findings = run.baseline?.findings ?? []
  const { suppressed } = filterSuppressed({
    findings,
    suppressions: run.ctx.settings.suppressions
  })
  const events: readonly ReviewEvent[] = [
    startedEvent(run),
    FindingsDecoded.make({ reviewer: run.key.reviewer, findings }),
    ...suppressed.map((fingerprint) =>
      FindingSuppressed.make({ reviewer: run.key.reviewer, fingerprint })
    ),
    ReplayServed.make({ reviewer: run.key.reviewer })
  ]
  return appendEvents({ key: run.key, attempt: run.attempt, events })
}

const failOpen =
  ({ run, started }: FailOpen) =>
  (error: {
    readonly _tag: string
    readonly message: string
  }): Effect.Effect<readonly ReviewEvent[], never, RunStore> => {
    const failed = ReviewerFailed.make({
      reviewer: run.key.reviewer,
      error: `${error._tag}: ${error.message}`,
      failOpen: true
    })
    return appendEvents({
      key: run.key,
      attempt: run.attempt,
      events: [failed]
    }).pipe(Effect.as([started, failed]))
  }

const liveSession = ({ run, startedAt }: LiveSession) => {
  const prompt = buildPrompt({
    config: run.reviewer.config,
    diff: run.diff,
    baseline: run.baseline
  })
  return runSession({
    key: run.key,
    attempt: run.attempt,
    prompt: prompt.user,
    system: prompt.system,
    policy: policyFor(run),
    maxTurns: run.reviewer.config.maxTurns ?? defaultMaxTurns,
    model: run.reviewer.config.model ?? null,
    effort: run.reviewer.config.effort ?? null,
    outputSchema: findingsSchemaFor(
      activeRules({ rules: run.reviewer.config.rules, files: run.diff.files })
    )
  }).pipe(
    Effect.timeout(
      Duration.millis(
        run.reviewer.config.timeoutMs ?? run.ctx.settings.timeoutMs
      )
    ),
    Effect.flatMap(({ model, events }) =>
      conclude({
        run,
        findings: fingerprinted({ run, model }),
        startedAt
      }).pipe(Effect.map((concluded) => [...events, ...concluded]))
    )
  )
}

const live = (
  run: ReviewerRun
): Effect.Effect<
  readonly ReviewEvent[],
  never,
  Agent | RunStore | ReviewClock
> => {
  const started = startedEvent(run)
  return appendEvents({
    key: run.key,
    attempt: run.attempt,
    events: [started]
  }).pipe(
    Effect.zipRight(Effect.flatMap(ReviewClock, (clock) => clock.now)),
    Effect.flatMap((startedAt) => liveSession({ run, startedAt })),
    Effect.map((events) => [started, ...events]),
    Effect.catchTags({
      AgentUnavailable: failOpen({ run, started }),
      FindingsParseError: failOpen({ run, started }),
      TimeoutException: failOpen({ run, started })
    })
  )
}

const replayable = (check: ReplayCheck): RunRecord | null =>
  !check.noCache &&
  check.record !== null &&
  check.record.diffHash === check.diffHash &&
  check.record.configHash === check.configHash
    ? check.record
    : null

const dispatch = (
  input: Dispatch
): Effect.Effect<
  readonly ReviewEvent[],
  never,
  Agent | RunStore | ReviewClock
> => {
  const settings = input.ctx.settings
  const dHash = diffHash({
    hash: settings.hash,
    diffText: input.diff.diffText
  })
  const cHash = configHash({
    hash: settings.hash,
    configText: input.reviewer.source
  })
  const hit = replayable({
    record: input.record,
    diffHash: dHash,
    configHash: cHash,
    noCache: settings.noCache
  })
  const run: ReviewerRun = {
    ctx: input.ctx,
    reviewer: input.reviewer,
    key: input.key,
    attempt: hit !== null ? hit.attempt : (input.record?.attempt ?? 0) + 1,
    baseline: input.baseline,
    diff: input.diff,
    diffHash: dHash,
    configHash: cHash
  }
  return hit !== null ? replay(run) : live(run)
}

const runReviewer =
  (ctx: ReviewContext) =>
  (
    reviewer: ReviewerSource
  ): Effect.Effect<
    readonly ReviewEvent[],
    never,
    Agent | RunStore | ReviewClock
  > => {
    const key: RunKey = {
      head: ctx.head,
      branch: ctx.branch,
      reviewer: reviewer.config.name
    }
    const diff = scopeDiff({ config: reviewer.config, diff: ctx.diff })
    if (diff.files.length === 0) {
      return skipped({ key, reason: 'no-matching-paths' })
    }
    const active = activeRules({
      rules: reviewer.config.rules,
      files: diff.files
    })
    if (active.length === 0) {
      return skipped({ key, reason: 'no-active-rules' })
    }
    return RunStore.pipe(
      Effect.flatMap((store) =>
        Effect.all({
          record: store.readRecord(key),
          baseline: store.readBaseline(key)
        })
      ),
      Effect.flatMap(({ record, baseline }) =>
        dispatch({ ctx, reviewer, key, record, baseline, diff })
      )
    )
  }

export { runReviewer }
