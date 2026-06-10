import { describe, expect, it } from 'vitest'
import {
  isAbsolutePath,
  normalizePath,
  resolveWithin
} from '../../src/core/path-normalize.js'

describe('normalizePath', () => {
  it('unifies separators and collapses dot segments', () => {
    expect(normalizePath('src\\.\\a\\..\\b.ts')).toBe('src/b.ts')
  })

  it('lowercases drive letters', () => {
    expect(normalizePath('C:\\repo\\src')).toBe('c:/repo/src')
  })

  it('keeps posix absolute paths absolute', () => {
    expect(normalizePath('/repo//src/./a.ts')).toBe('/repo/src/a.ts')
  })

  it('preserves leading parent segments on relative paths', () => {
    expect(normalizePath('../../etc/passwd')).toBe('../../etc/passwd')
  })
})

describe('isAbsolutePath', () => {
  it('detects posix, windows drive, and UNC-style prefixes', () => {
    expect(isAbsolutePath('/etc')).toBe(true)
    expect(isAbsolutePath('C:\\repo')).toBe(true)
    expect(isAbsolutePath('\\\\server\\share')).toBe(true)
    expect(isAbsolutePath('src/a.ts')).toBe(false)
  })
})

describe('resolveWithin', () => {
  it('joins relative paths onto the root', () => {
    expect(resolveWithin({ root: '/repo', path: 'src/a.ts' })).toBe(
      '/repo/src/a.ts'
    )
  })

  it('collapses escapes through the root', () => {
    expect(resolveWithin({ root: '/repo', path: '../outside' })).toBe(
      '/outside'
    )
  })

  it('passes absolute paths through normalization', () => {
    expect(resolveWithin({ root: '/repo', path: 'C:\\other' })).toBe('c:/other')
  })
})
