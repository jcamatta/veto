import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { Schema } from 'effect'
import { initialState, reduce } from '../../src/core/reducer.js'
import { Finding, Fingerprint } from '../../src/domain/finding.js'
import {
  AgentEvent,
  BaselineResolved,
  FindingSuppressed,
  FindingsDecoded,
  ReplayServed,
  ReviewEvent,
  ReviewerFailed,
  ReviewerSkipped,
  RunCompleted,
  RunStarted
} from '../../src/domain/review-event.js'

const fp = Schema.decodeSync(Fingerprint)

const finding = (fingerprint: string): Finding => ({
  severity: 'error',
  file: 'src/a.ts',
  line: 1,
  rule: 'r',
  message: 'm',
  fingerprint: fp(fingerprint)
})

const fold = (events: readonly ReviewEvent[]) =>
  events.reduce((state, event) => reduce(state)(event), initialState)

const started = RunStarted.make({
  key: { head: 'a1b2c3', branch: 'main', reviewer: 'architect' },
  attempt: 2,
  diffHash: 'dh',
  configHash: 'ch'
})

describe('reduce', () => {
  it('RunStarted records key, attempt, and hashes', () => {
    const state = fold([started])
    expect(state.key?.head).toBe('a1b2c3')
    expect(state.attempt).toBe(2)
    expect(state.diffHash).toBe('dh')
    expect(state.configHash).toBe('ch')
  })

  it('ReviewerSkipped and ReplayServed set statuses', () => {
    const state = fold([
      ReviewerSkipped.make({ reviewer: 'a', reason: 'no-matching-paths' }),
      ReplayServed.make({ reviewer: 'b' })
    ])
    expect(state.reviewers).toEqual([
      { name: 'a', status: 'skipped', findings: [], resolved: [] },
      { name: 'b', status: 'replayed', findings: [], resolved: [] }
    ])
  })

  it('FindingsDecoded stores findings and keeps replayed status', () => {
    const f = finding('aaaaaaaaaaaa')
    const state = fold([
      ReplayServed.make({ reviewer: 'a' }),
      FindingsDecoded.make({ reviewer: 'a', findings: [f] })
    ])
    expect(state.reviewers[0]?.status).toBe('replayed')
    expect(state.reviewers[0]?.findings).toEqual([f])
  })

  it('FindingSuppressed removes the matching finding', () => {
    const kept = finding('aaaaaaaaaaaa')
    const dropped = finding('bbbbbbbbbbbb')
    const state = fold([
      FindingsDecoded.make({ reviewer: 'a', findings: [kept, dropped] }),
      FindingSuppressed.make({ reviewer: 'a', fingerprint: fp('bbbbbbbbbbbb') })
    ])
    expect(state.reviewers[0]?.findings).toEqual([kept])
  })

  it('BaselineResolved records resolved fingerprints', () => {
    const state = fold([
      BaselineResolved.make({ reviewer: 'a', fingerprints: [fp('aaaaaaaaaaaa')] })
    ])
    expect(state.reviewers[0]?.resolved).toEqual(['aaaaaaaaaaaa'])
  })

  it('ReviewerFailed marks unavailable and clears findings', () => {
    const state = fold([
      FindingsDecoded.make({ reviewer: 'a', findings: [finding('aaaaaaaaaaaa')] }),
      ReviewerFailed.make({ reviewer: 'a', error: 'offline', failOpen: true })
    ])
    expect(state.reviewers[0]?.status).toBe('unavailable')
    expect(state.reviewers[0]?.findings).toEqual([])
  })

  it('RunCompleted sets blocking and completed', () => {
    const state = fold([RunCompleted.make({ blocking: true })])
    expect(state.blocking).toBe(true)
    expect(state.completed).toBe(true)
  })

  it('AgentEvent and ToolCallDenied leave state unchanged', () => {
    const before = fold([started])
    const after = reduce(before)(AgentEvent.make({ reviewer: 'a', raw: { x: 1 } }))
    expect(after).toEqual(before)
  })

  it('never mutates the input state (property)', () => {
    const events: readonly ReviewEvent[] = [
      started,
      FindingsDecoded.make({ reviewer: 'a', findings: [finding('aaaaaaaaaaaa')] }),
      ReviewerFailed.make({ reviewer: 'a', error: 'x', failOpen: true }),
      RunCompleted.make({ blocking: false })
    ]
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: events.length - 1 }), { minLength: 1 }),
        (indices) => {
          const sequence = indices.map((i) => events[i] ?? started)
          fold(sequence)
          expect(initialState).toEqual({
            key: null,
            attempt: 1,
            diffHash: null,
            configHash: null,
            reviewers: [],
            blocking: false,
            completed: false
          })
        }
      )
    )
  })

  it('interleaved AgentEvents never change the outcome (property)', () => {
    const meaningful: readonly ReviewEvent[] = [
      started,
      FindingsDecoded.make({ reviewer: 'a', findings: [finding('aaaaaaaaaaaa')] }),
      RunCompleted.make({ blocking: true })
    ]
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 3 })), (positions) => {
        const noise = AgentEvent.make({ reviewer: 'a', raw: null })
        const interleaved = positions.reduce<readonly ReviewEvent[]>(
          (acc, pos) => [...acc.slice(0, pos), noise, ...acc.slice(pos)],
          meaningful
        )
        expect(fold(interleaved)).toEqual(fold(meaningful))
      })
    )
  })
})
