import { Chunk, Effect, Stream } from 'effect'
import { resultText } from '../core/agent-output.js'
import { parseFindings } from '../core/findings-parse.js'
import { appendParseRetry } from '../core/prompt.js'
import { type Result, isOk } from '../core/result.js'
import type {
  AgentUnavailable,
  FindingsParseError
} from '../domain/errors.js'
import type { ModelFindings } from '../domain/finding.js'
import {
  AgentEvent,
  ToolCallDenied,
  type ReviewEvent
} from '../domain/review-event.js'
import type { RunKey } from '../domain/run-key.js'
import {
  Agent,
  type AgentRunInput,
  type AgentStreamItem
} from '../ports/agent.js'
import { RunStore } from '../ports/run-store.js'

type SessionInput = {
  readonly key: RunKey
  readonly attempt: number
  readonly prompt: string
  readonly policy: AgentRunInput['policy']
  readonly maxTurns: number
}

type RetrySession = {
  readonly input: SessionInput
  readonly error: FindingsParseError
}

const toEvent =
  (reviewer: string) =>
  (item: AgentStreamItem): ReviewEvent =>
    item._tag === 'AgentMessage'
      ? AgentEvent.make({ reviewer, raw: item.raw })
      : ToolCallDenied.make({
          reviewer,
          tool: item.tool,
          path: item.path,
          reason: item.reason
        })

const collectEvents = (
  input: SessionInput
): Effect.Effect<
  Chunk.Chunk<ReviewEvent>,
  AgentUnavailable,
  Agent | RunStore
> =>
  Effect.all({ agent: Agent, store: RunStore }).pipe(
    Effect.flatMap(({ agent, store }) =>
      agent
        .run({
          prompt: input.prompt,
          policy: input.policy,
          limits: { maxTurns: input.maxTurns }
        })
        .pipe(
          Stream.map(toEvent(input.key.reviewer)),
          Stream.tap((event) =>
            store.appendEvent({ key: input.key, attempt: input.attempt, event })
          ),
          Stream.runCollect
        )
    )
  )

const rawMessages = (events: Chunk.Chunk<ReviewEvent>): readonly unknown[] =>
  Chunk.toReadonlyArray(events).flatMap((event) =>
    event._tag === 'AgentEvent' ? [event.raw] : []
  )

const sessionFindings = (
  input: SessionInput
): Effect.Effect<
  Result<ModelFindings, FindingsParseError>,
  AgentUnavailable,
  Agent | RunStore
> =>
  collectEvents(input).pipe(
    Effect.map((events) => parseFindings(resultText(rawMessages(events))))
  )

const retrySession = ({
  input,
  error
}: RetrySession): Effect.Effect<
  ModelFindings,
  AgentUnavailable | FindingsParseError,
  Agent | RunStore
> =>
  sessionFindings({
    ...input,
    prompt: appendParseRetry({ prompt: input.prompt, message: error.message })
  }).pipe(
    Effect.flatMap((second) =>
      isOk(second) ? Effect.succeed(second.value) : Effect.fail(second.error)
    )
  )

const runSession = (
  input: SessionInput
): Effect.Effect<
  ModelFindings,
  AgentUnavailable | FindingsParseError,
  Agent | RunStore
> =>
  sessionFindings(input).pipe(
    Effect.flatMap((first) =>
      isOk(first)
        ? Effect.succeed(first.value)
        : retrySession({ input, error: first.error })
    )
  )

export { type SessionInput, runSession }
