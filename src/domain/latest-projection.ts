import { Schema } from 'effect'
import { Finding, Fingerprint } from './finding.js'
import { ReviewerStats } from './reviewer-stats.js'

const ReviewerStatus = Schema.Literal(
  'completed',
  'replayed',
  'skipped',
  'unavailable'
)

type ReviewerStatus = typeof ReviewerStatus.Type

const ReviewerOutcome = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  status: ReviewerStatus,
  findings: Schema.Array(Finding),
  resolved: Schema.Array(Fingerprint),
  stats: Schema.optional(ReviewerStats),
  failure: Schema.optional(Schema.NonEmptyString),
  skipReason: Schema.optional(Schema.NonEmptyString)
})

type ReviewerOutcome = typeof ReviewerOutcome.Type

const LatestProjection = Schema.Struct({
  ranAt: Schema.DateTimeUtc,
  head: Schema.NonEmptyTrimmedString,
  branch: Schema.NonEmptyTrimmedString,
  attempt: Schema.Positive.pipe(Schema.int()),
  reviewers: Schema.Array(ReviewerOutcome),
  blocking: Schema.Boolean
})

type LatestProjection = typeof LatestProjection.Type

export { ReviewerStatus, ReviewerOutcome, LatestProjection }
