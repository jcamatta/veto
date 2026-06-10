import { DateTime } from 'effect'
import { LatestProjection } from '../domain/latest-projection.js'
import { emptyRepoSentinel } from '../domain/run-key.js'
import { isBlocking } from './exit-code.js'
import { type RunState } from './reducer.js'

type ProjectionInput = {
  readonly state: RunState
  readonly ranAt: DateTime.Utc
}

const unknownBranch = 'unknown'

const buildProjection = ({ state, ranAt }: ProjectionInput): LatestProjection => ({
  ranAt,
  head: state.key?.head ?? emptyRepoSentinel,
  branch: state.key?.branch ?? unknownBranch,
  attempt: state.attempt,
  reviewers: state.reviewers,
  blocking: isBlocking(state.reviewers)
})

export { type ProjectionInput, buildProjection }
