import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { LatestProjection } from '../../src/domain/latest-projection.js'

const decode = Schema.decodeUnknownEither(LatestProjection)

const finding = {
  severity: 'error',
  file: 'src/api/users.ts',
  line: 42,
  rule: 'no cross-layer imports',
  message: 'UI component imports the repository directly.',
  fingerprint: 'a94f3c21e0b7'
}

const valid = {
  ranAt: '2026-06-09T14:03:22Z',
  head: 'a1b2c3',
  branch: 'feat/auth',
  attempt: 3,
  reviewers: [
    {
      name: 'architect',
      status: 'completed',
      findings: [finding],
      resolved: ['b94f3c21e0b8']
    }
  ],
  blocking: true
}

describe('LatestProjection', () => {
  it('decodes a valid projection', () => {
    expect(Either.isRight(decode(valid))).toBe(true)
  })

  it('accepts every reviewer status', () => {
    const statuses = ['completed', 'replayed', 'skipped', 'unavailable']
    statuses.forEach((status) => {
      const reviewers = [{ name: 'a', status, findings: [], resolved: [] }]
      expect(Either.isRight(decode({ ...valid, reviewers }))).toBe(true)
    })
  })

  it('rejects an unknown reviewer status', () => {
    const reviewers = [{ name: 'a', status: 'crashed', findings: [], resolved: [] }]
    expect(Either.isLeft(decode({ ...valid, reviewers }))).toBe(true)
  })

  it('accepts optional stats and failure on a reviewer outcome', () => {
    const reviewers = [
      {
        name: 'architect',
        status: 'unavailable',
        findings: [],
        resolved: [],
        failure: 'TimeoutException: timed out',
        stats: {
          turns: 2,
          inputTokens: 100,
          outputTokens: 50,
          costUsd: null,
          durationMs: 900,
          toolCalls: 1,
          denials: 0
        }
      }
    ]
    expect(Either.isRight(decode({ ...valid, reviewers }))).toBe(true)
  })

  it('rejects a missing blocking flag', () => {
    const rest = Object.fromEntries(
      Object.entries(valid).filter(([key]) => key !== 'blocking')
    )
    expect(Either.isLeft(decode(rest))).toBe(true)
  })
})
