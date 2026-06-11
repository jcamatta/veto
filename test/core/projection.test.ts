import { describe, expect, it } from 'vitest'
import { DateTime, Schema } from 'effect'
import { buildProjection } from '../../src/core/projection.js'
import { initialState, reduce } from '../../src/core/reducer.js'
import { Fingerprint } from '../../src/domain/finding.js'
import {
  FindingsDecoded,
  ReviewEvent,
  RunStarted
} from '../../src/domain/review-event.js'

const fp = Schema.decodeSync(Fingerprint)

const ranAt = DateTime.unsafeMake(0)

const fold = (events: readonly ReviewEvent[]) =>
  events.reduce((state, event) => reduce(state)(event), initialState)

const stateWith = (severity: 'error' | 'warning') =>
  fold([
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
          severity,
          file: 'src/a.ts',
          line: 1,
          rule: 'r',
          message: 'm',
          fingerprint: fp('aaaaaaaaaaaa')
        }
      ]
    })
  ])

describe('buildProjection', () => {
  it('projects head and branch from git truth and the rest from state', () => {
    const projection = buildProjection({
      state: stateWith('error'),
      ranAt,
      head: 'a1b2c3',
      branch: 'main',
      failOn: 'error'
    })
    expect(projection.head).toBe('a1b2c3')
    expect(projection.branch).toBe('main')
    expect(projection.attempt).toBe(3)
    expect(projection.reviewers).toHaveLength(1)
    expect(projection.blocking).toBe(true)
  })

  it('derives blocking from findings, not from RunCompleted', () => {
    const projection = buildProjection({
      state: initialState,
      ranAt,
      head: 'a1b2c3',
      branch: 'main',
      failOn: 'error'
    })
    expect(projection.blocking).toBe(false)
  })

  it('derives blocking from the fail-on threshold', () => {
    const base = {
      state: stateWith('warning'),
      ranAt,
      head: 'a1b2c3',
      branch: 'main'
    }
    expect(buildProjection({ ...base, failOn: 'error' }).blocking).toBe(false)
    expect(buildProjection({ ...base, failOn: 'warning' }).blocking).toBe(true)
    expect(
      buildProjection({ ...base, state: stateWith('error'), failOn: 'never' })
        .blocking
    ).toBe(false)
  })

  it('carries head and branch even when no reviewer emitted RunStarted', () => {
    const projection = buildProjection({
      state: initialState,
      ranAt,
      head: 'feedbeef',
      branch: 'feat/x',
      failOn: 'error'
    })
    expect(projection.head).toBe('feedbeef')
    expect(projection.branch).toBe('feat/x')
    expect(projection.attempt).toBe(1)
  })
})
