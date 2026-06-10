import { Chunk, Effect, JSONSchema, Stream } from 'effect'
import {
  resultText,
  structuredOutput,
  structuredRetriesExhausted
} from '../core/agent-output.js'
import { parseFindings, structuredFindings } from '../core/findings-parse.js'
import { appendParseRetry } from '../core/prompt.js'
import { type Result, err, isOk } from '../core/result.js'
import {
  findingsParseError,
  type AgentUnavailable,
  type FindingsParseError
} from '../domain/errors.js'
import { ModelFindings } from '../domain/finding.js'
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

type SessionOutcome = {
  readonly model: ModelFindings
  readonly events: readonly ReviewEvent[]
}

type ParsedSession = {
  readonly result: Result<ModelFindings, FindingsParseError>
  readonly events: readonly ReviewEvent[]
  readonly structured: boolean
}

const findingsSchema: Record<string, unknown> = {
  ...JSONSchema.make(ModelFindings)
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
          limits: { maxTurns: input.maxTurns },
          outputSchema: findingsSchema
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

const parseSession = (chunk: Chunk.Chunk<ReviewEvent>): ParsedSession => {
  const raws = rawMessages(chunk)
  const structured = structuredOutput(raws)
  const exhausted = structuredRetriesExhausted(raws)
  const result = exhausted
    ? err(
        findingsParseError(
          'structured output failed validation after model retries'
        )
      )
    : structured === undefined
      ? parseFindings(resultText(raws))
      : structuredFindings(structured)
  return {
    result,
    events: Chunk.toReadonlyArray(chunk),
    structured: exhausted || structured !== undefined
  }
}

const sessionFindings = (
  input: SessionInput
): Effect.Effect<ParsedSession, AgentUnavailable, Agent | RunStore> =>
  collectEvents(input).pipe(Effect.map(parseSession))

const retrySession = ({
  input,
  error
}: RetrySession): Effect.Effect<
  SessionOutcome,
  AgentUnavailable | FindingsParseError,
  Agent | RunStore
> =>
  sessionFindings({
    ...input,
    prompt: appendParseRetry({ prompt: input.prompt, message: error.message })
  }).pipe(
    Effect.flatMap((second) =>
      isOk(second.result)
        ? Effect.succeed({ model: second.result.value, events: second.events })
        : Effect.fail(second.result.error)
    )
  )

const runSession = (
  input: SessionInput
): Effect.Effect<
  SessionOutcome,
  AgentUnavailable | FindingsParseError,
  Agent | RunStore
> =>
  sessionFindings(input).pipe(
    Effect.flatMap((first) =>
      isOk(first.result)
        ? Effect.succeed({ model: first.result.value, events: first.events })
        : first.structured
          ? Effect.fail(first.result.error)
          : retrySession({ input, error: first.result.error }).pipe(
              Effect.map((second) => ({
                model: second.model,
                events: [...first.events, ...second.events]
              }))
            )
    )
  )

export { type SessionInput, type SessionOutcome, runSession }
