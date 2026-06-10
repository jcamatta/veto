import { describe, expect, it } from 'vitest'
import { err, isErr, isOk, map, ok } from '../../src/core/result.js'

describe('result', () => {
  it('ok wraps a value', () => {
    const result = ok(42)
    expect(isOk(result)).toBe(true)
    expect(result.value).toBe(42)
  })

  it('err wraps an error', () => {
    const result = err('boom')
    expect(isErr(result)).toBe(true)
    expect(result.error).toBe('boom')
  })

  it('map transforms an Ok value', () => {
    const result = map((n: number) => n * 2)(ok(21))
    expect(result).toEqual(ok(42))
  })

  it('map passes an Err through unchanged', () => {
    const result = map((n: number) => n * 2)(err('boom'))
    expect(result).toEqual(err('boom'))
  })
})
