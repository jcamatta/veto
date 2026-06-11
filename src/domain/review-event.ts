import { Schema } from 'effect'
import { Finding, Fingerprint } from './finding.js'
import { RunKey } from './run-key.js'

const RunStarted = Schema.TaggedStruct('RunStarted', {
  key: RunKey,
  attempt: Schema.Positive.pipe(Schema.int()),
  diffHash: Schema.NonEmptyTrimmedString,
  configHash: Schema.NonEmptyTrimmedString
})

const ReviewerSkipped = Schema.TaggedStruct('ReviewerSkipped', {
  reviewer: Schema.NonEmptyTrimmedString,
  reason: Schema.Literal(
    'no-matching-paths',
    'no-active-rules',
    'diff-too-large'
  )
})

const ReplayServed = Schema.TaggedStruct('ReplayServed', {
  reviewer: Schema.NonEmptyTrimmedString
})

const AgentEvent = Schema.TaggedStruct('AgentEvent', {
  reviewer: Schema.NonEmptyTrimmedString,
  raw: Schema.Unknown
})

const ToolCallDenied = Schema.TaggedStruct('ToolCallDenied', {
  reviewer: Schema.NonEmptyTrimmedString,
  tool: Schema.NonEmptyTrimmedString,
  path: Schema.String,
  reason: Schema.NonEmptyString
})

const FindingsDecoded = Schema.TaggedStruct('FindingsDecoded', {
  reviewer: Schema.NonEmptyTrimmedString,
  findings: Schema.Array(Finding)
})

const FindingSuppressed = Schema.TaggedStruct('FindingSuppressed', {
  reviewer: Schema.NonEmptyTrimmedString,
  fingerprint: Fingerprint
})

const FindingOutOfScope = Schema.TaggedStruct('FindingOutOfScope', {
  reviewer: Schema.NonEmptyTrimmedString,
  fingerprint: Fingerprint,
  rule: Schema.NonEmptyString
})

const BaselineResolved = Schema.TaggedStruct('BaselineResolved', {
  reviewer: Schema.NonEmptyTrimmedString,
  fingerprints: Schema.Array(Fingerprint)
})

const ReviewerFailed = Schema.TaggedStruct('ReviewerFailed', {
  reviewer: Schema.NonEmptyTrimmedString,
  error: Schema.NonEmptyString,
  failOpen: Schema.Literal(true)
})

const RunCompleted = Schema.TaggedStruct('RunCompleted', {
  blocking: Schema.Boolean
})

const ReviewEvent = Schema.Union(
  RunStarted,
  ReviewerSkipped,
  ReplayServed,
  AgentEvent,
  ToolCallDenied,
  FindingsDecoded,
  FindingSuppressed,
  FindingOutOfScope,
  BaselineResolved,
  ReviewerFailed,
  RunCompleted
)

type ReviewEvent = typeof ReviewEvent.Type

export {
  RunStarted,
  ReviewerSkipped,
  ReplayServed,
  AgentEvent,
  ToolCallDenied,
  FindingsDecoded,
  FindingSuppressed,
  FindingOutOfScope,
  BaselineResolved,
  ReviewerFailed,
  RunCompleted,
  ReviewEvent
}
