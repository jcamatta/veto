import { describe, expect, it } from 'vitest'
import { buildFileMatcher } from '../../src/core/glob-matcher.js'

describe('buildFileMatcher', () => {
  it('matches everything when no globs are given', () => {
    const matches = buildFileMatcher({})
    expect(matches('src/a.ts')).toBe(true)
    expect(matches('.config/b.yaml')).toBe(true)
  })

  it('restricts to paths globs including dotfiles', () => {
    const matches = buildFileMatcher({ paths: ['src/**', '.husky/**'] })
    expect(matches('src/a.ts')).toBe(true)
    expect(matches('.husky/pre-commit')).toBe(true)
    expect(matches('docs/a.md')).toBe(false)
  })

  it('excludes ignore globs from the match', () => {
    const matches = buildFileMatcher({
      paths: ['src/**'],
      ignore: ['**/*.test.ts']
    })
    expect(matches('src/a.ts')).toBe(true)
    expect(matches('src/a.test.ts')).toBe(false)
  })

  it('treats an empty ignore list as no exclusion', () => {
    const matches = buildFileMatcher({ ignore: [] })
    expect(matches('anything')).toBe(true)
  })
})
