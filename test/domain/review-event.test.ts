import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { ReviewEvent } from '../../src/domain/review-event.js'

const decode = Schema.decodeUnknownEither(ReviewEvent)

const finding = {
  severity: 'info',
  file: 'src/a.ts',
  line: 7,
  rule: 'a rule',
  message: 'a message',
  fingerprint: 'a94f3c21e0b7'
}

const validEvents = [
  {
    _tag: 'RunStarted',
    key: { head: 'a1b2c3', branch: 'main', reviewer: 'architect' },
    attempt: 1,
    diffHash: 'deadbeef',
    configHash: 'cafebabe'
  },
  { _tag: 'ReviewerSkipped', reviewer: 'architect', reason: 'no-matching-paths' },
  { _tag: 'ReplayServed', reviewer: 'architect' },
  { _tag: 'AgentEvent', reviewer: 'architect', raw: { type: 'assistant', text: 'hi' } },
  {
    _tag: 'ToolCallDenied',
    reviewer: 'architect',
    tool: 'Read',
    path: '/etc/passwd',
    reason: 'outside repo root'
  },
  { _tag: 'FindingsDecoded', reviewer: 'architect', findings: [finding] },
  { _tag: 'FindingSuppressed', reviewer: 'architect', fingerprint: 'a94f3c21e0b7' },
  { _tag: 'BaselineResolved', reviewer: 'architect', fingerprints: ['a94f3c21e0b7'] },
  { _tag: 'ReviewerFailed', reviewer: 'architect', error: 'credit exhausted', failOpen: true },
  { _tag: 'RunCompleted', blocking: false }
]

describe('ReviewEvent', () => {
  it('decodes every event variant', () => {
    validEvents.forEach((event) => {
      const result = decode(event)
      expect(Either.isRight(result), `should decode ${event._tag}`).toBe(true)
    })
  })

  it('rejects an unknown tag', () => {
    expect(Either.isLeft(decode({ _tag: 'Exploded', reviewer: 'x' }))).toBe(true)
  })

  it('rejects ReviewerSkipped with an unknown reason', () => {
    const result = decode({ _tag: 'ReviewerSkipped', reviewer: 'a', reason: 'bored' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects ReviewerFailed with failOpen false', () => {
    const result = decode({ _tag: 'ReviewerFailed', reviewer: 'a', error: 'x', failOpen: false })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('preserves the raw payload of AgentEvent verbatim', () => {
    const raw = { nested: { anything: [1, 2, 3] } }
    const result = decode({ _tag: 'AgentEvent', reviewer: 'a', raw })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result) && result.right._tag === 'AgentEvent') {
      expect(result.right.raw).toEqual(raw)
    }
  })
})
