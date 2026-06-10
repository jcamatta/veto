import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { ReviewerStats } from '../../src/domain/reviewer-stats.js'

const decode = Schema.decodeUnknownEither(ReviewerStats)

describe('ReviewerStats schema', () => {
  it('decodes a fully populated stats object', () => {
    const result = decode({
      turns: 3,
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.05,
      durationMs: 1500,
      toolCalls: 4,
      denials: 1
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('decodes nullable usage fields as null', () => {
    const result = decode({
      turns: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: null,
      toolCalls: 0,
      denials: 0
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects negative counters', () => {
    const result = decode({
      turns: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: null,
      toolCalls: -1,
      denials: 0
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects fractional turn counts', () => {
    const result = decode({
      turns: 1.5,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: null,
      toolCalls: 0,
      denials: 0
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})
