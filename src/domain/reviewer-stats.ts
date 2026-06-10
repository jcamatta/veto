import { Schema } from 'effect'

const Count = Schema.NonNegative.pipe(Schema.int())

const ReviewerStats = Schema.Struct({
  turns: Schema.NullOr(Count),
  inputTokens: Schema.NullOr(Count),
  outputTokens: Schema.NullOr(Count),
  costUsd: Schema.NullOr(Schema.NonNegative),
  durationMs: Schema.NullOr(Schema.NonNegative),
  toolCalls: Count,
  denials: Count
})

type ReviewerStats = typeof ReviewerStats.Type

export { ReviewerStats }
