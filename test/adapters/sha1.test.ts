import { describe, expect, it } from 'vitest'
import { sha1 } from '../../src/adapters/sha1.js'

describe('sha1', () => {
  it('hashes the empty string to the known vector', () => {
    expect(sha1('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
  })

  it('hashes abc to the known vector', () => {
    expect(sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('is deterministic and discriminates inputs', () => {
    expect(sha1('veto')).toBe(sha1('veto'))
    expect(sha1('a')).not.toBe(sha1('b'))
  })
})
