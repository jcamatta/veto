import { Context, Effect } from 'effect'
import type { Baseline } from '../domain/baseline.js'
import type { LatestProjection } from '../domain/latest-projection.js'
import type { ReviewEvent } from '../domain/review-event.js'
import type { RunKey } from '../domain/run-key.js'
import type { RunRecord } from '../domain/run-record.js'

type AppendEventInput = {
  readonly key: RunKey
  readonly attempt: number
  readonly event: ReviewEvent
}

type WriteBaselineInput = {
  readonly key: RunKey
  readonly baseline: Baseline
}

type WriteRecordInput = {
  readonly key: RunKey
  readonly record: RunRecord
}

type WriteProjectionsInput = {
  readonly projection: LatestProjection
  readonly markdown: string
}

type RunStoreService = {
  readonly appendEvent: (input: AppendEventInput) => Effect.Effect<void>
  readonly readBaseline: (key: RunKey) => Effect.Effect<Baseline | null>
  readonly writeBaseline: (input: WriteBaselineInput) => Effect.Effect<void>
  readonly readRecord: (key: RunKey) => Effect.Effect<RunRecord | null>
  readonly writeRecord: (input: WriteRecordInput) => Effect.Effect<void>
  readonly writeProjections: (input: WriteProjectionsInput) => Effect.Effect<void>
  readonly prune: (keep: number) => Effect.Effect<void>
}

class RunStore extends Context.Tag('veto/RunStore')<
  RunStore,
  RunStoreService
>() {}

export {
  type AppendEventInput,
  type WriteBaselineInput,
  type WriteRecordInput,
  type WriteProjectionsInput,
  type RunStoreService,
  RunStore
}
