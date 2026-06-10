import { Schema } from 'effect'

const emptyRepoSentinel = 'EMPTY_REPO'

const RunKey = Schema.Struct({
  head: Schema.NonEmptyTrimmedString,
  branch: Schema.NonEmptyTrimmedString,
  reviewer: Schema.NonEmptyTrimmedString
})

type RunKey = typeof RunKey.Type

export { RunKey, emptyRepoSentinel }
