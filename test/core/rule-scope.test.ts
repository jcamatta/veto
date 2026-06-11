import { describe, expect, it } from 'vitest'
import { ruleAppliesTo } from '../../src/core/rule-scope.js'

const scoped = {
  id: 'tenant-id',
  instruction: 'every query carries the tenant id',
  paths: ['src/modules/**'] as const,
  ignore: ['**/*.spec.ts']
}

describe('ruleAppliesTo', () => {
  it('applies plain string rules to every file', () => {
    expect(ruleAppliesTo({ rule: 'plain rule', file: 'anywhere/a.ts' })).toBe(
      true
    )
  })

  it('applies identified rules without globs to every file', () => {
    const rule = { id: 'a', instruction: 'x' }
    expect(ruleAppliesTo({ rule, file: 'src/a.ts' })).toBe(true)
    expect(ruleAppliesTo({ rule, file: 'docs/b.md' })).toBe(true)
  })

  it('restricts a rule to files matching its paths globs', () => {
    expect(ruleAppliesTo({ rule: scoped, file: 'src/modules/a.ts' })).toBe(true)
    expect(ruleAppliesTo({ rule: scoped, file: 'src/other/a.ts' })).toBe(false)
  })

  it('excludes files matching the rule ignore globs', () => {
    expect(ruleAppliesTo({ rule: scoped, file: 'src/modules/a.spec.ts' })).toBe(
      false
    )
  })

  it('ignore alone narrows the default match-everything scope', () => {
    const rule = { id: 'a', instruction: 'x', ignore: ['**/*.md'] }
    expect(ruleAppliesTo({ rule, file: 'src/a.ts' })).toBe(true)
    expect(ruleAppliesTo({ rule, file: 'docs/b.md' })).toBe(false)
  })

  it('matches dotfiles like the reviewer-level scope does', () => {
    const rule = { id: 'a', instruction: 'x', paths: ['.config/**'] as const }
    expect(ruleAppliesTo({ rule, file: '.config/a.yaml' })).toBe(true)
  })
})
