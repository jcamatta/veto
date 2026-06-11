import { Schema } from 'effect'

const Count = Schema.NonNegative.pipe(Schema.int())

const SeverityCounts = Schema.Struct({
  error: Count,
  warning: Count,
  info: Count
})

type SeverityCounts = typeof SeverityCounts.Type

const RuleStats = Schema.Struct({
  rule: Schema.NonEmptyString,
  fired: Count,
  suppressed: Count,
  severities: SeverityCounts,
  lastHead: Schema.NonEmptyTrimmedString
})

type RuleStats = typeof RuleStats.Type

const RuleStatsReport = Schema.Struct({
  retainedHeads: Schema.Positive.pipe(Schema.int()),
  rules: Schema.Array(RuleStats)
})

type RuleStatsReport = typeof RuleStatsReport.Type

export { SeverityCounts, RuleStats, RuleStatsReport }
