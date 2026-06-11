import { DateTime, Effect } from 'effect'
import { diffBaseline } from '../core/baseline-diff.js'
import { fingerprintFinding } from '../core/fingerprint.js'
import { partitionByRuleScope } from '../core/finding-scope.js'
import { filterSuppressed } from '../core/suppression.js'
import type { Finding, ModelFindings } from '../domain/finding.js'
import {
  BaselineResolved,
  FindingOutOfScope,
  FindingsDecoded,
  FindingSuppressed,
  type ReviewEvent
} from '../domain/review-event.js'
import type { RunRecord } from '../domain/run-record.js'
import { ReviewClock } from '../ports/clock.js'
import { RunStore } from '../ports/run-store.js'
import { appendEvents, type ReviewerRun } from './reviewer-run.js'

type Fingerprinted = {
  readonly run: ReviewerRun
  readonly model: ModelFindings
}

type Conclude = {
  readonly run: ReviewerRun
  readonly findings: readonly Finding[]
  readonly startedAt: DateTime.Utc
}

type Persist = {
  readonly run: ReviewerRun
  readonly kept: readonly Finding[]
  readonly startedAt: DateTime.Utc
}

type Ended = Persist & { readonly endedAt: DateTime.Utc }

const fingerprinted = ({ run, model }: Fingerprinted): readonly Finding[] =>
  model.findings.map((finding) =>
    fingerprintFinding({
      hash: run.ctx.settings.hash,
      reviewer: run.key.reviewer,
      finding
    })
  )

const recordOf = ({ run, startedAt, endedAt }: Ended): RunRecord => ({
  diffHash: run.diffHash,
  configHash: run.configHash,
  attempt: run.attempt,
  sessionId: null,
  ranAt: startedAt,
  durationMs: Math.max(
    DateTime.toEpochMillis(endedAt) - DateTime.toEpochMillis(startedAt),
    0
  )
})

const persist = (
  input: Persist
): Effect.Effect<void, never, RunStore | ReviewClock> =>
  Effect.all({ store: RunStore, clock: ReviewClock }).pipe(
    Effect.flatMap(({ store, clock }) =>
      clock.now.pipe(
        Effect.flatMap((endedAt) =>
          Effect.zipRight(
            store.writeBaseline({
              key: input.run.key,
              baseline: { attempt: input.run.attempt, findings: input.kept }
            }),
            store.writeRecord({
              key: input.run.key,
              record: recordOf({ ...input, endedAt })
            })
          )
        )
      )
    )
  )

const conclude = (
  input: Conclude
): Effect.Effect<readonly ReviewEvent[], never, RunStore | ReviewClock> => {
  const reviewer = input.run.key.reviewer
  const { applicable, outOfScope } = partitionByRuleScope({
    rules: input.run.rules,
    findings: input.findings
  })
  const { kept, suppressed } = filterSuppressed({
    findings: applicable,
    suppressions: input.run.ctx.settings.suppressions
  })
  const { resolved } = diffBaseline({
    baseline: input.run.baseline,
    current: kept
  })
  const events: readonly ReviewEvent[] = [
    FindingsDecoded.make({ reviewer, findings: input.findings }),
    ...outOfScope.map((finding) =>
      FindingOutOfScope.make({
        reviewer,
        fingerprint: finding.fingerprint,
        rule: finding.rule
      })
    ),
    ...suppressed.map((fingerprint) =>
      FindingSuppressed.make({ reviewer, fingerprint })
    ),
    BaselineResolved.make({ reviewer, fingerprints: resolved })
  ]
  return appendEvents({
    key: input.run.key,
    attempt: input.run.attempt,
    events
  }).pipe(Effect.zipLeft(persist({ ...input, kept })))
}

export { type Fingerprinted, type Conclude, fingerprinted, conclude }
