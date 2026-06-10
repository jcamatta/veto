import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { RunRecord } from '../../src/domain/run-record.js'

const decode = Schema.decodeUnknownEither(RunRecord)

const valid = {
  diffHash: 'deadbeef',
  configHash: 'cafebabe',
  attempt: 1,
  sessionId: 'sess-123',
  ranAt: '2026-06-09T14:03:22Z',
  durationMs: 4200
}

describe('RunRecord', () => {
  it('decodes a valid record', () => {
    expect(Either.isRight(decode(valid))).toBe(true)
  })

  it('accepts a null sessionId', () => {
    expect(Either.isRight(decode({ ...valid, sessionId: null }))).toBe(true)
  })

  it('rejects an invalid timestamp', () => {
    expect(Either.isLeft(decode({ ...valid, ranAt: 'yesterday' }))).toBe(true)
  })

  it('rejects a negative duration', () => {
    expect(Either.isLeft(decode({ ...valid, durationMs: -1 }))).toBe(true)
  })

  it('rejects a non-positive attempt', () => {
    expect(Either.isLeft(decode({ ...valid, attempt: 0 }))).toBe(true)
  })
})
