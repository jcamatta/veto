import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { Schema } from 'effect'
import { initialState, reduce } from '../../src/core/reducer.js'
import { Finding, Fingerprint } from '../../src/domain/finding.js'
import {
  AgentEvent,
  BaselineResolved,
  FindingOutOfScope,
  FindingSuppressed,
  FindingsDecoded,
  ReplayServed,
  ReviewEvent,
  ReviewerFailed,
  ReviewerSkipped,
  RunCompleted,
  RunStarted,
  ToolCallDenied
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
      {
        name: 'a',
        status: 'skipped',
        skipReason: 'no-matching-paths',
        findings: [],
        resolved: []
      },
      { name: 'b', status: 'replayed', findings: [], resolved: [] }
    ])
  })

  it('ReviewerSkipped records the diff-too-large reason', () => {
    const state = fold([
      ReviewerSkipped.make({ reviewer: 'a', reason: 'diff-too-large' })
    ])
    expect(state.reviewers[0]?.skipReason).toBe('diff-too-large')
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

  it('FindingOutOfScope removes the matching finding', () => {
    const kept = finding('aaaaaaaaaaaa')
    const dropped = finding('bbbbbbbbbbbb')
    const state = fold([
      FindingsDecoded.make({ reviewer: 'a', findings: [kept, dropped] }),
      FindingOutOfScope.make({
        reviewer: 'a',
        fingerprint: fp('bbbbbbbbbbbb'),
        rule: 'r'
      })
    ])
    expect(state.reviewers[0]?.findings).toEqual([kept])
  })

  it('BaselineResolved records resolved fingerprints', () => {
    const state = fold([
      BaselineResolved.make({ reviewer: 'a', fingerprints: [fp('aaaaaaaaaaaa')] })
    ])
    expect(state.reviewers[0]?.resolved).toEqual(['aaaaaaaaaaaa'])
  })

  it('ReviewerFailed marks unavailable, clears findings, and records the cause', () => {
    const state = fold([
      FindingsDecoded.make({ reviewer: 'a', findings: [finding('aaaaaaaaaaaa')] }),
      ReviewerFailed.make({ reviewer: 'a', error: 'offline', failOpen: true })
    ])
    expect(state.reviewers[0]?.status).toBe('unavailable')
    expect(state.reviewers[0]?.findings).toEqual([])
    expect(state.reviewers[0]?.failure).toBe('offline')
  })

  it('RunCompleted sets blocking and completed', () => {
    const state = fold([RunCompleted.make({ blocking: true })])
    expect(state.blocking).toBe(true)
    expect(state.completed).toBe(true)
  })

  it('AgentEvent accumulates usage and tool calls into stats only', () => {
    const state = fold([
      AgentEvent.make({
        reviewer: 'a',
        raw: {
          type: 'assistant',
          message: {
            model: 'claude-sonnet-4-6',
            content: [{ type: 'tool_use' }, { type: 'text' }]
          }
        }
      }),
      AgentEvent.make({
        reviewer: 'a',
        raw: {
          type: 'result',
          result: '{}',
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 400,
            cache_read_input_tokens: 4000,
            output_tokens: 20
          },
          total_cost_usd: 0.01,
          num_turns: 3,
          duration_ms: 1500
        }
      })
    ])
    expect(state.reviewers[0]?.stats).toEqual({
      model: 'claude-sonnet-4-6',
      turns: 3,
      inputTokens: 100,
      cacheCreationTokens: 400,
      cacheReadTokens: 4000,
      outputTokens: 20,
      costUsd: 0.01,
      durationMs: 1500,
      toolCalls: 1,
      denials: 0
    })
    expect(state.reviewers[0]?.status).toBe('completed')
    expect(state.reviewers[0]?.findings).toEqual([])
  })

  it('ToolCallDenied increments the denial count', () => {
    const state = fold([
      ToolCallDenied.make({
        reviewer: 'a',
        tool: 'Read',
        path: '../x',
        reason: 'outside repo root'
      })
    ])
    expect(state.reviewers[0]?.stats?.denials).toBe(1)
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

  it('interleaved AgentEvents never change the verdict (property)', () => {
    const meaningful: readonly ReviewEvent[] = [
      started,
      FindingsDecoded.make({ reviewer: 'a', findings: [finding('aaaaaaaaaaaa')] }),
      RunCompleted.make({ blocking: true })
    ]
    const verdict = (events: readonly ReviewEvent[]) => {
      const state = fold(events)
      return {
        blocking: state.blocking,
        reviewers: state.reviewers.map((r) => ({
          name: r.name,
          status: r.status,
          findings: r.findings,
          resolved: r.resolved
        }))
      }
    }
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 3 })), (positions) => {
        const noise = AgentEvent.make({ reviewer: 'a', raw: null })
        const interleaved = positions.reduce<readonly ReviewEvent[]>(
          (acc, pos) => [...acc.slice(0, pos), noise, ...acc.slice(pos)],
          meaningful
        )
        expect(verdict(interleaved)).toEqual(verdict(meaningful))
      })
    )
  })
})
