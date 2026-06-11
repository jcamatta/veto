import { Match } from 'effect'
import { ReviewEvent } from '../domain/review-event.js'
import { Finding, Fingerprint } from '../domain/finding.js'
import {
  ReviewerOutcome,
  ReviewerStatus
} from '../domain/latest-projection.js'
import { RunKey } from '../domain/run-key.js'
import { accumulateMessage, bumpDenials, emptyStats } from './agent-stats.js'

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
  readonly update: Update
}

type Update = (outcome: ReviewerOutcome) => ReviewerOutcome

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

const setStatus =
  (status: ReviewerStatus): Update =>
  (o) => ({ ...o, status })

const setSkipped =
  (reason: string): Update =>
  (o) => ({ ...o, status: 'skipped', skipReason: reason })

const trackMessage =
  (raw: unknown): Update =>
  (o) => ({ ...o, stats: accumulateMessage(o.stats ?? emptyStats)(raw) })

const trackDenial: Update = (o) => ({
  ...o,
  stats: bumpDenials(o.stats ?? emptyStats)
})

const setFindings =
  (findings: readonly Finding[]): Update =>
  (o) => ({ ...o, findings })

const dropFinding =
  (fingerprint: Fingerprint): Update =>
  (o) => ({
    ...o,
    findings: o.findings.filter((f) => f.fingerprint !== fingerprint)
  })

const setResolved =
  (fingerprints: readonly Fingerprint[]): Update =>
  (o) => ({ ...o, resolved: fingerprints })

const failOpen =
  (error: string): Update =>
  (o) => ({ ...o, status: 'unavailable', findings: [], failure: error })

const reduce =
  (state: RunState) =>
  (event: ReviewEvent): RunState => {
    const touch =
      (name: string) =>
      (update: Update): RunState =>
        upsertOutcome({ state, name, update })
    return Match.value(event).pipe(
      Match.tag('RunStarted', (e) => ({
        ...state,
        key: e.key,
        attempt: e.attempt,
        diffHash: e.diffHash,
        configHash: e.configHash
      })),
      Match.tag('ReviewerSkipped', (e) => touch(e.reviewer)(setSkipped(e.reason))),
      Match.tag('ReplayServed', (e) => touch(e.reviewer)(setStatus('replayed'))),
      Match.tag('AgentEvent', (e) => touch(e.reviewer)(trackMessage(e.raw))),
      Match.tag('ToolCallDenied', (e) => touch(e.reviewer)(trackDenial)),
      Match.tag('FindingsDecoded', (e) => touch(e.reviewer)(setFindings(e.findings))),
      Match.tag('FindingSuppressed', (e) => touch(e.reviewer)(dropFinding(e.fingerprint))),
      Match.tag('FindingOutOfScope', (e) => touch(e.reviewer)(dropFinding(e.fingerprint))),
      Match.tag('BaselineResolved', (e) => touch(e.reviewer)(setResolved(e.fingerprints))),
      Match.tag('ReviewerFailed', (e) => touch(e.reviewer)(failOpen(e.error))),
      Match.tag('RunCompleted', (e) => ({
        ...state,
        blocking: e.blocking,
        completed: true
      })),
      Match.exhaustive
    )
  }

export { type RunState, initialState, reduce }
