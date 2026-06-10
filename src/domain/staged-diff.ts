import { Schema } from 'effect'

const StagedDiff = Schema.Struct({
  diffText: Schema.String,
  files: Schema.Array(Schema.NonEmptyTrimmedString)
})

type StagedDiff = typeof StagedDiff.Type

export { StagedDiff }
