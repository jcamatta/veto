import { DateTime } from 'effect'
import type { FailOn } from '../domain/fail-on.js'
import { LatestProjection } from '../domain/latest-projection.js'
import { blocksAt } from './exit-code.js'
import { type RunState } from './reducer.js'

type ProjectionInput = {
  readonly state: RunState
  readonly ranAt: DateTime.Utc
  readonly head: string
  readonly branch: string
  readonly failOn: FailOn
}

const buildProjection = ({
  state,
  ranAt,
  head,
  branch,
  failOn
}: ProjectionInput): LatestProjection => ({
  ranAt,
  head,
  branch,
  attempt: state.attempt,
  reviewers: state.reviewers,
  blocking: blocksAt(failOn)(state.reviewers)
})

export { type ProjectionInput, buildProjection }
