import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { StagedDiff } from '../../src/domain/staged-diff.js'

const decode = Schema.decodeUnknownEither(StagedDiff)

describe('StagedDiff', () => {
  it('decodes a diff with files', () => {
    const result = decode({
      diffText: 'diff --git a/src/a.ts b/src/a.ts\n+const a = 1',
      files: ['src/a.ts']
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts an empty diff with no files', () => {
    expect(Either.isRight(decode({ diffText: '', files: [] }))).toBe(true)
  })

  it('rejects blank file names', () => {
    expect(Either.isLeft(decode({ diffText: '', files: [' '] }))).toBe(true)
  })

  it('rejects a missing diffText', () => {
    expect(Either.isLeft(decode({ files: [] }))).toBe(true)
  })
})
