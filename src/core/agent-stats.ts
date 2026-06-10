import { Option, Schema } from 'effect'
import { ReviewerStats } from '../domain/reviewer-stats.js'

const ResultShape = Schema.Struct({
  type: Schema.Literal('result'),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Schema.optional(Schema.Number),
      output_tokens: Schema.optional(Schema.Number)
    })
  ),
  total_cost_usd: Schema.optional(Schema.Number),
  num_turns: Schema.optional(Schema.Number),
  duration_ms: Schema.optional(Schema.Number)
})

const AssistantShape = Schema.Struct({
  type: Schema.Literal('assistant'),
  message: Schema.Struct({ content: Schema.Array(Schema.Unknown) })
})

const BlockShape = Schema.Struct({ type: Schema.String })

const decodeResult = Schema.decodeUnknownOption(ResultShape)
const decodeAssistant = Schema.decodeUnknownOption(AssistantShape)
const decodeBlock = Schema.decodeUnknownOption(BlockShape)

const emptyStats: ReviewerStats = {
  turns: null,
  inputTokens: null,
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

const toolUses = (raw: unknown): number =>
  Option.match(decodeAssistant(raw), {
    onNone: () => 0,
    onSome: (m) => m.message.content.filter(isToolUse).length
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
        outputTokens: plus(stats.outputTokens)(r.usage?.output_tokens),
        costUsd: plus(stats.costUsd)(r.total_cost_usd),
        durationMs: plus(stats.durationMs)(r.duration_ms)
      })
    })

const accumulateMessage =
  (stats: ReviewerStats) =>
  (raw: unknown): ReviewerStats => {
    const next = withResult(stats)(raw)
    const calls = toolUses(raw)
    return calls === 0 ? next : { ...next, toolCalls: next.toolCalls + calls }
  }

const bumpDenials = (stats: ReviewerStats): ReviewerStats => ({
  ...stats,
  denials: stats.denials + 1
})

export { emptyStats, accumulateMessage, bumpDenials }
