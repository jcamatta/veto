import { Effect } from 'effect'
import type { Baseline } from '../domain/baseline.js'
import { RunStarted, type ReviewEvent } from '../domain/review-event.js'
import type { RunKey } from '../domain/run-key.js'
import { RunStore } from '../ports/run-store.js'
import type { ReviewContext, ReviewerSource } from './inputs.js'

type ReviewerRun = {
  readonly ctx: ReviewContext
  readonly reviewer: ReviewerSource
  readonly key: RunKey
  readonly attempt: number
  readonly baseline: Baseline | null
  readonly diffHash: string
  readonly configHash: string
}

type AppendInput = {
  readonly key: RunKey
  readonly attempt: number
  readonly events: readonly ReviewEvent[]
}

const appendEvents = (
  input: AppendInput
): Effect.Effect<readonly ReviewEvent[], never, RunStore> =>
  RunStore.pipe(
    Effect.flatMap((store) =>
      Effect.forEach(input.events, (event) =>
        store.appendEvent({ key: input.key, attempt: input.attempt, event })
      )
    ),
    Effect.as(input.events)
  )

const startedEvent = (run: ReviewerRun): ReviewEvent =>
  RunStarted.make({
    key: run.key,
    attempt: run.attempt,
    diffHash: run.diffHash,
    configHash: run.configHash
  })

export { type ReviewerRun, type AppendInput, appendEvents, startedEvent }
