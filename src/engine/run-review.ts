import { Effect } from 'effect'
import { exitCode, isBlocking, type ExitCode } from '../core/exit-code.js'
import { renderMarkdown } from '../core/markdown.js'
import { buildProjection } from '../core/projection.js'
import { initialState, reduce, type RunState } from '../core/reducer.js'
import {
  configError,
  type ConfigError,
  type GitError
} from '../domain/errors.js'
import { RunCompleted, type ReviewEvent } from '../domain/review-event.js'
import { Agent } from '../ports/agent.js'
import { ReviewClock } from '../ports/clock.js'
import { Git } from '../ports/git.js'
import { Reporter, type ReportFormat } from '../ports/reporter.js'
import { retainedHeads, RunStore } from '../ports/run-store.js'
import type { ReviewContext, RunReviewInput } from './inputs.js'
import { runReviewer } from './run-reviewer.js'

type Publish = {
  readonly ctx: ReviewContext
  readonly state: RunState
  readonly format: ReportFormat
}

const reviewerConcurrency = 4

const rejectRuntimeModes = (
  input: RunReviewInput
): Effect.Effect<void, ConfigError> => {
  const runtime = input.reviewers.filter((r) => r.config.mode === 'runtime')
  return runtime.length === 0
    ? Effect.void
    : Effect.fail(
        configError(
          `mode "runtime" is not supported in v1: ${runtime
            .map((r) => r.config.name)
            .join(', ')}`
        )
      )
}

const gatherContext = (
  input: RunReviewInput
): Effect.Effect<ReviewContext, GitError, Git> =>
  Git.pipe(
    Effect.flatMap((git) =>
      Effect.all({ diff: git.stagedDiff, head: git.head, branch: git.branch })
    ),
    Effect.map(({ diff, head, branch }) => ({
      settings: input.settings,
      diff,
      head,
      branch
    }))
  )

const foldEvents = (input: {
  readonly state: RunState
  readonly events: readonly ReviewEvent[]
}): RunState => {
  const [head, ...rest] = input.events
  return head === undefined
    ? input.state
    : foldEvents({ state: reduce(input.state)(head), events: rest })
}

const foldRun = (events: readonly ReviewEvent[]): RunState => {
  const folded = foldEvents({ state: initialState, events })
  return reduce(folded)(
    RunCompleted.make({ blocking: isBlocking(folded.reviewers) })
  )
}

const publish = (
  input: Publish
): Effect.Effect<void, never, RunStore | Reporter | ReviewClock> =>
  Effect.all({ store: RunStore, reporter: Reporter, clock: ReviewClock }).pipe(
    Effect.flatMap(({ store, reporter, clock }) =>
      clock.now.pipe(
        Effect.flatMap((ranAt) => {
          const projection = buildProjection({
            state: input.state,
            ranAt,
            head: input.ctx.head,
            branch: input.ctx.branch
          })
          return store
            .writeProjections({
              projection,
              markdown: renderMarkdown(projection)
            })
            .pipe(
              Effect.zipRight(store.prune(retainedHeads)),
              Effect.zipRight(
                reporter.emit({ projection, format: input.format })
              )
            )
        })
      )
    )
  )

const runReview = (
  input: RunReviewInput
): Effect.Effect<
  ExitCode,
  ConfigError | GitError,
  Git | Agent | RunStore | Reporter | ReviewClock
> =>
  rejectRuntimeModes(input).pipe(
    Effect.zipRight(gatherContext(input)),
    Effect.flatMap((ctx) =>
      Effect.all(input.reviewers.map(runReviewer(ctx)), {
        concurrency: reviewerConcurrency
      }).pipe(
        Effect.map((lists) => foldRun(lists.flat())),
        Effect.flatMap((state) =>
          publish({ ctx, state, format: input.format }).pipe(
            Effect.as(exitCode(state.blocking))
          )
        )
      )
    )
  )

export { runReview }
