import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { Baseline } from '../../src/domain/baseline.js'

const decode = Schema.decodeUnknownEither(Baseline)

const finding = {
  severity: 'warning',
  file: 'src/a.ts',
  line: null,
  rule: 'a rule',
  message: 'a message',
  fingerprint: 'a94f3c21e0b7'
}

describe('Baseline', () => {
  it('decodes a baseline with findings', () => {
    expect(Either.isRight(decode({ attempt: 2, findings: [finding] }))).toBe(true)
  })

  it('accepts an empty findings array', () => {
    expect(Either.isRight(decode({ attempt: 1, findings: [] }))).toBe(true)
  })

  it('rejects a non-positive attempt', () => {
    expect(Either.isLeft(decode({ attempt: 0, findings: [] }))).toBe(true)
  })

  it('rejects findings without fingerprints', () => {
    const bare = Object.fromEntries(
      Object.entries(finding).filter(([key]) => key !== 'fingerprint')
    )
    expect(Either.isLeft(decode({ attempt: 1, findings: [bare] }))).toBe(true)
  })
})
