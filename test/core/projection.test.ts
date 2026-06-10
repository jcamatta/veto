import { describe, expect, it } from 'vitest'
import { DateTime, Schema } from 'effect'
import { buildProjection } from '../../src/core/projection.js'
import { initialState, reduce } from '../../src/core/reducer.js'
import { Fingerprint } from '../../src/domain/finding.js'
import { emptyRepoSentinel } from '../../src/domain/run-key.js'
import {
  FindingsDecoded,
  ReviewEvent,
  RunStarted
} from '../../src/domain/review-event.js'

const fp = Schema.decodeSync(Fingerprint)

const ranAt = DateTime.unsafeMake(0)

const fold = (events: readonly ReviewEvent[]) =>
  events.reduce((state, event) => reduce(state)(event), initialState)

describe('buildProjection', () => {
  it('projects head, branch, attempt, and reviewers from state', () => {
    const state = fold([
      RunStarted.make({
        key: { head: 'a1b2c3', branch: 'main', reviewer: 'architect' },
        attempt: 3,
        diffHash: 'dh',
        configHash: 'ch'
      }),
      FindingsDecoded.make({
        reviewer: 'architect',
        findings: [
          {
            severity: 'error',
            file: 'src/a.ts',
            line: 1,
            rule: 'r',
            message: 'm',
            fingerprint: fp('aaaaaaaaaaaa')
          }
        ]
      })
    ])
    const projection = buildProjection({ state, ranAt })
    expect(projection.head).toBe('a1b2c3')
    expect(projection.branch).toBe('main')
    expect(projection.attempt).toBe(3)
    expect(projection.reviewers).toHaveLength(1)
    expect(projection.blocking).toBe(true)
  })

  it('derives blocking from findings, not from RunCompleted', () => {
    const projection = buildProjection({ state: initialState, ranAt })
    expect(projection.blocking).toBe(false)
  })

  it('falls back to the empty-repo sentinel without a RunStarted', () => {
    const projection = buildProjection({ state: initialState, ranAt })
    expect(projection.head).toBe(emptyRepoSentinel)
    expect(projection.branch).toBe('unknown')
  })
})
