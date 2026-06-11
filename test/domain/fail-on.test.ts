import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { FailOn, defaultFailOn } from '../../src/domain/fail-on.js'

const decode = Schema.decodeUnknownEither(FailOn)

describe('FailOn', () => {
  it('accepts each threshold level', () => {
    const levels = ['error', 'warning', 'info', 'never']
    expect(levels.map((l) => decode(l)).map(Either.isRight)).toEqual([
      true,
      true,
      true,
      true
    ])
  })

  it('rejects unknown levels', () => {
    expect(Either.isLeft(decode('fatal'))).toBe(true)
    expect(Either.isLeft(decode(''))).toBe(true)
    expect(Either.isLeft(decode(1))).toBe(true)
  })

  it('defaults to error', () => {
    expect(defaultFailOn).toBe('error')
  })
})
