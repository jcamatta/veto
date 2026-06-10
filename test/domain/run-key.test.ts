import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { RunKey, emptyRepoSentinel } from '../../src/domain/run-key.js'

const decode = Schema.decodeUnknownEither(RunKey)

describe('RunKey', () => {
  it('decodes a key with head, branch and reviewer', () => {
    const result = decode({ head: 'a1b2c3', branch: 'feat/auth', reviewer: 'architect' })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts the empty-repo sentinel as head', () => {
    const result = decode({ head: emptyRepoSentinel, branch: 'main', reviewer: 'architect' })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects a blank head', () => {
    expect(Either.isLeft(decode({ head: ' ', branch: 'main', reviewer: 'architect' }))).toBe(true)
  })

  it('rejects a missing reviewer', () => {
    expect(Either.isLeft(decode({ head: 'a1b2c3', branch: 'main' }))).toBe(true)
  })
})
