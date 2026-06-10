import { Schema } from 'effect'

const Severity = Schema.Literal('error', 'warning', 'info')

type Severity = typeof Severity.Type

const Fingerprint = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{6,40}$/),
  Schema.brand('Fingerprint')
)

type Fingerprint = typeof Fingerprint.Type

const ModelFinding = Schema.Struct({
  severity: Severity,
  file: Schema.NonEmptyTrimmedString,
  line: Schema.NullOr(Schema.Positive.pipe(Schema.int())),
  rule: Schema.NonEmptyString,
  message: Schema.NonEmptyString,
  suggestion: Schema.optional(Schema.String)
})

type ModelFinding = typeof ModelFinding.Type

const ModelFindings = Schema.Struct({
  findings: Schema.Array(ModelFinding)
})

type ModelFindings = typeof ModelFindings.Type

const Finding = Schema.Struct({
  ...ModelFinding.fields,
  fingerprint: Fingerprint
})

type Finding = typeof Finding.Type

export { Severity, Fingerprint, ModelFinding, ModelFindings, Finding }
