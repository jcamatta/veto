import { Schema } from 'effect'

const ReviewerMode = Schema.Literal('static', 'runtime')

type ReviewerMode = typeof ReviewerMode.Type

const ReviewerEffort = Schema.Literal('low', 'medium', 'high', 'xhigh', 'max')

type ReviewerEffort = typeof ReviewerEffort.Type

const RuleId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  Schema.maxLength(64)
)

const IdentifiedRule = Schema.Struct({
  id: RuleId,
  rule: Schema.NonEmptyString
})

type IdentifiedRule = typeof IdentifiedRule.Type

const ReviewerRule = Schema.Union(Schema.NonEmptyString, IdentifiedRule)

type ReviewerRule = typeof ReviewerRule.Type

const uniqueRuleIds = (rules: readonly ReviewerRule[]): boolean => {
  const ids = rules.flatMap((rule) =>
    typeof rule === 'string' ? [] : [rule.id]
  )
  return new Set(ids).size === ids.length
}

const ReviewerConfig = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  mode: ReviewerMode,
  paths: Schema.NonEmptyArray(Schema.NonEmptyTrimmedString),
  ignore: Schema.optionalWith(Schema.Array(Schema.NonEmptyTrimmedString), {
    default: () => []
  }),
  systemPrompt: Schema.NonEmptyString,
  rules: Schema.NonEmptyArray(ReviewerRule).pipe(
    Schema.filter(uniqueRuleIds, {
      message: () => 'rule ids must be unique within a reviewer config'
    })
  ),
  model: Schema.optional(Schema.NonEmptyTrimmedString),
  effort: Schema.optional(ReviewerEffort),
  maxTurns: Schema.optional(Schema.Positive.pipe(Schema.int())),
  timeoutMs: Schema.optional(Schema.Positive.pipe(Schema.int()))
})

type ReviewerConfig = typeof ReviewerConfig.Type

export {
  ReviewerConfig,
  ReviewerMode,
  ReviewerEffort,
  ReviewerRule,
  IdentifiedRule
}
