import { Schema } from 'effect'

const RunRecord = Schema.Struct({
  diffHash: Schema.NonEmptyTrimmedString,
  configHash: Schema.NonEmptyTrimmedString,
  attempt: Schema.Positive.pipe(Schema.int()),
  sessionId: Schema.NullOr(Schema.NonEmptyTrimmedString),
  ranAt: Schema.DateTimeUtc,
  durationMs: Schema.NonNegative
})

type RunRecord = typeof RunRecord.Type

export { RunRecord }
