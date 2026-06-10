import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { SuppressionList } from '../../src/domain/suppression-list.js'

const decode = Schema.decodeUnknownEither(SuppressionList)

describe('SuppressionList', () => {
  it('decodes a list of fingerprints', () => {
    expect(Either.isRight(decode({ fingerprints: ['a94f3c21e0b7'] }))).toBe(true)
  })

  it('accepts an empty list', () => {
    expect(Either.isRight(decode({ fingerprints: [] }))).toBe(true)
  })

  it('rejects non-hex fingerprints', () => {
    expect(Either.isLeft(decode({ fingerprints: ['hello world'] }))).toBe(true)
  })
})
