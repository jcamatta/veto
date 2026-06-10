import { Schema } from 'effect'

const Count = Schema.NonNegative.pipe(Schema.int())

const ReviewerStats = Schema.Struct({
  model: Schema.NullOr(Schema.String),
  turns: Schema.NullOr(Count),
  inputTokens: Schema.NullOr(Count),
  cacheCreationTokens: Schema.NullOr(Count),
  cacheReadTokens: Schema.NullOr(Count),
  outputTokens: Schema.NullOr(Count),
  costUsd: Schema.NullOr(Schema.NonNegative),
  durationMs: Schema.NullOr(Schema.NonNegative),
  toolCalls: Count,
  denials: Count
})

type ReviewerStats = typeof ReviewerStats.Type

export { ReviewerStats }
