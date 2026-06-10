import { DateTime } from 'effect'
import { LatestProjection } from '../domain/latest-projection.js'
import { isBlocking } from './exit-code.js'
import { type RunState } from './reducer.js'

type ProjectionInput = {
  readonly state: RunState
  readonly ranAt: DateTime.Utc
  readonly head: string
  readonly branch: string
}

const buildProjection = ({
  state,
  ranAt,
  head,
  branch
}: ProjectionInput): LatestProjection => ({
  ranAt,
  head,
  branch,
  attempt: state.attempt,
  reviewers: state.reviewers,
  blocking: isBlocking(state.reviewers)
})

export { type ProjectionInput, buildProjection }
