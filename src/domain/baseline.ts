import { Schema } from 'effect'
import { Finding } from './finding.js'

const Baseline = Schema.Struct({
  attempt: Schema.Positive.pipe(Schema.int()),
  findings: Schema.Array(Finding)
})

type Baseline = typeof Baseline.Type

export { Baseline }
