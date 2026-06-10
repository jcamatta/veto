import { Schema } from 'effect'

const ReviewerMode = Schema.Literal('static', 'runtime')

type ReviewerMode = typeof ReviewerMode.Type

const ReviewerEffort = Schema.Literal('low', 'medium', 'high', 'xhigh', 'max')

type ReviewerEffort = typeof ReviewerEffort.Type

const ReviewerConfig = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  mode: ReviewerMode,
  paths: Schema.NonEmptyArray(Schema.NonEmptyTrimmedString),
  ignore: Schema.optionalWith(Schema.Array(Schema.NonEmptyTrimmedString), {
    default: () => []
  }),
  systemPrompt: Schema.NonEmptyString,
  rules: Schema.NonEmptyArray(Schema.NonEmptyString),
  model: Schema.optional(Schema.NonEmptyTrimmedString),
  effort: Schema.optional(ReviewerEffort),
  maxTurns: Schema.optional(Schema.Positive.pipe(Schema.int())),
  timeoutMs: Schema.optional(Schema.Positive.pipe(Schema.int()))
})

type ReviewerConfig = typeof ReviewerConfig.Type

export { ReviewerConfig, ReviewerMode, ReviewerEffort }
