import { Match } from 'effect'
import { ReviewEvent } from '../domain/review-event.js'
import { ReviewerOutcome } from '../domain/latest-projection.js'
import { RunKey } from '../domain/run-key.js'

type RunState = {
  readonly key: RunKey | null
  readonly attempt: number
  readonly diffHash: string | null
  readonly configHash: string | null
  readonly reviewers: readonly ReviewerOutcome[]
  readonly blocking: boolean
  readonly completed: boolean
}

type Upsert = {
  readonly state: RunState
  readonly name: string
  readonly update: (outcome: ReviewerOutcome) => ReviewerOutcome
}

const initialState: RunState = {
  key: null,
  attempt: 1,
  diffHash: null,
  configHash: null,
  reviewers: [],
  blocking: false,
  completed: false
}

const emptyOutcome = (name: string): ReviewerOutcome => ({
  name,
  status: 'completed',
  findings: [],
  resolved: []
})

const upsertOutcome = ({ state, name, update }: Upsert): RunState => {
  const existing = state.reviewers.find((r) => r.name === name)
  const next = update(existing ?? emptyOutcome(name))
  const reviewers =
    existing === undefined
      ? [...state.reviewers, next]
      : state.reviewers.map((r) => (r.name === name ? next : r))
  return { ...state, reviewers }
}

const reduce =
  (state: RunState) =>
  (event: ReviewEvent): RunState =>
    Match.value(event).pipe(
      Match.tag('RunStarted', (e) => ({
        ...state,
        key: e.key,
        attempt: e.attempt,
        diffHash: e.diffHash,
        configHash: e.configHash
      })),
      Match.tag('ReviewerSkipped', (e) =>
        upsertOutcome({
          state,
          name: e.reviewer,
          update: (o) => ({ ...o, status: 'skipped' as const })
        })
      ),
      Match.tag('ReplayServed', (e) =>
        upsertOutcome({
          state,
          name: e.reviewer,
          update: (o) => ({ ...o, status: 'replayed' as const })
        })
      ),
      Match.tag('AgentEvent', () => state),
      Match.tag('ToolCallDenied', () => state),
      Match.tag('FindingsDecoded', (e) =>
        upsertOutcome({
          state,
          name: e.reviewer,
          update: (o) => ({ ...o, findings: e.findings })
        })
      ),
      Match.tag('FindingSuppressed', (e) =>
        upsertOutcome({
          state,
          name: e.reviewer,
          update: (o) => ({
            ...o,
            findings: o.findings.filter(
              (f) => f.fingerprint !== e.fingerprint
            )
          })
        })
      ),
      Match.tag('BaselineResolved', (e) =>
        upsertOutcome({
          state,
          name: e.reviewer,
          update: (o) => ({ ...o, resolved: e.fingerprints })
        })
      ),
      Match.tag('ReviewerFailed', (e) =>
        upsertOutcome({
          state,
          name: e.reviewer,
          update: (o) => ({
            ...o,
            status: 'unavailable' as const,
            findings: []
          })
        })
      ),
      Match.tag('RunCompleted', (e) => ({
        ...state,
        blocking: e.blocking,
        completed: true
      })),
      Match.exhaustive
    )

export { type RunState, initialState, reduce }
