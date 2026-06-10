import { Schema } from 'effect'

const ReviewerMode = Schema.Literal('static', 'runtime')

type ReviewerMode = typeof ReviewerMode.Type

const ReviewerConfig = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  mode: ReviewerMode,
  paths: Schema.NonEmptyArray(Schema.NonEmptyTrimmedString),
  ignore: Schema.optionalWith(Schema.Array(Schema.NonEmptyTrimmedString), {
    default: () => []
  }),
  systemPrompt: Schema.NonEmptyString,
  rules: Schema.NonEmptyArray(Schema.NonEmptyString)
})

type ReviewerConfig = typeof ReviewerConfig.Type

export { ReviewerConfig, ReviewerMode }
