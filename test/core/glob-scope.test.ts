import { describe, expect, it } from 'vitest'
import { scopeFiles } from '../../src/core/glob-scope.js'
import { ReviewerConfig } from '../../src/domain/reviewer-config.js'

const config: ReviewerConfig = {
  name: 'architect',
  mode: 'static',
  paths: ['src/**/*.ts'],
  ignore: ['**/*.test.ts', '**/generated/**'],
  systemPrompt: 'You are an architect.',
  rules: ['no cross-layer imports']
}

describe('scopeFiles', () => {
  it('keeps files matching paths and not ignored', () => {
    const result = scopeFiles({
      config,
      files: ['src/api/users.ts', 'src/api/users.test.ts', 'README.md']
    })
    expect(result.inScope).toEqual(['src/api/users.ts'])
    expect(result.matched).toBe(true)
  })

  it('drops files under ignored directories', () => {
    const result = scopeFiles({
      config,
      files: ['src/generated/client.ts']
    })
    expect(result.inScope).toEqual([])
    expect(result.matched).toBe(false)
  })

  it('reports no match when nothing in scope', () => {
    const result = scopeFiles({ config, files: ['docs/SPEC.md'] })
    expect(result.matched).toBe(false)
  })

  it('matches everything when ignore is empty', () => {
    const open: ReviewerConfig = { ...config, ignore: [] }
    const result = scopeFiles({
      config: open,
      files: ['src/a.ts', 'src/a.test.ts']
    })
    expect(result.inScope).toEqual(['src/a.ts', 'src/a.test.ts'])
  })

  it('matches dotfiles', () => {
    const dotted: ReviewerConfig = { ...config, paths: ['**/*.yaml'], ignore: [] }
    const result = scopeFiles({
      config: dotted,
      files: ['.veto/architect.yaml']
    })
    expect(result.matched).toBe(true)
  })
})
