import { Schema } from 'effect'
import { Fingerprint } from './finding.js'

const SuppressionList = Schema.Struct({
  fingerprints: Schema.Array(Fingerprint)
})

type SuppressionList = typeof SuppressionList.Type

export { SuppressionList }
