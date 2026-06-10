import { Option, Schema } from 'effect'
import { ReviewerStats } from '../domain/reviewer-stats.js'

const ResultShape = Schema.Struct({
  type: Schema.Literal('result'),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Schema.optional(Schema.Number),
      cache_creation_input_tokens: Schema.optional(Schema.Number),
      cache_read_input_tokens: Schema.optional(Schema.Number),
      output_tokens: Schema.optional(Schema.Number)
    })
  ),
  total_cost_usd: Schema.optional(Schema.Number),
  num_turns: Schema.optional(Schema.Number),
  duration_ms: Schema.optional(Schema.Number)
})

const AssistantShape = Schema.Struct({
  type: Schema.Literal('assistant'),
  message: Schema.Struct({
    model: Schema.optional(Schema.String),
    content: Schema.Array(Schema.Unknown)
  })
})

const BlockShape = Schema.Struct({ type: Schema.String })

const decodeResult = Schema.decodeUnknownOption(ResultShape)
const decodeAssistant = Schema.decodeUnknownOption(AssistantShape)
const decodeBlock = Schema.decodeUnknownOption(BlockShape)

const emptyStats: ReviewerStats = {
  model: null,
  turns: null,
  inputTokens: null,
  cacheCreationTokens: null,
  cacheReadTokens: null,
  outputTokens: null,
  costUsd: null,
  durationMs: null,
  toolCalls: 0,
  denials: 0
}

const plus =
  (current: number | null) =>
  (extra: number | undefined): number | null =>
    extra === undefined ? current : (current ?? 0) + extra

const isToolUse = (block: unknown): boolean =>
  Option.match(decodeBlock(block), {
    onNone: () => false,
    onSome: (b) => b.type === 'tool_use'
  })

const withResult =
  (stats: ReviewerStats) =>
  (raw: unknown): ReviewerStats =>
    Option.match(decodeResult(raw), {
      onNone: () => stats,
      onSome: (r) => ({
        ...stats,
        turns: plus(stats.turns)(r.num_turns),
        inputTokens: plus(stats.inputTokens)(r.usage?.input_tokens),
        cacheCreationTokens: plus(stats.cacheCreationTokens)(
          r.usage?.cache_creation_input_tokens
        ),
        cacheReadTokens: plus(stats.cacheReadTokens)(
          r.usage?.cache_read_input_tokens
        ),
        outputTokens: plus(stats.outputTokens)(r.usage?.output_tokens),
        costUsd: plus(stats.costUsd)(r.total_cost_usd),
        durationMs: plus(stats.durationMs)(r.duration_ms)
      })
    })

const withAssistant =
  (stats: ReviewerStats) =>
  (raw: unknown): ReviewerStats =>
    Option.match(decodeAssistant(raw), {
      onNone: () => stats,
      onSome: (m) => ({
        ...stats,
        model: m.message.model ?? stats.model,
        toolCalls: stats.toolCalls + m.message.content.filter(isToolUse).length
      })
    })

const accumulateMessage =
  (stats: ReviewerStats) =>
  (raw: unknown): ReviewerStats =>
    withAssistant(withResult(stats)(raw))(raw)

const bumpDenials = (stats: ReviewerStats): ReviewerStats => ({
  ...stats,
  denials: stats.denials + 1
})

export { emptyStats, accumulateMessage, bumpDenials }
