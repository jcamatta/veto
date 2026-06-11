import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import {
  activeRules,
  partitionByRuleScope,
  ruleAppliesTo
} from '../../src/core/rule-scope.js'
import { Fingerprint, type Finding } from '../../src/domain/finding.js'

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

describe('activeRules', () => {
  it('keeps enabled rules that apply to at least one file', () => {
    const rules = [scoped, 'plain rule'] as const
    const files = ['src/modules/a.ts', 'docs/b.md']
    expect(activeRules({ rules: [...rules], files })).toEqual([...rules])
  })

  it('drops disabled rules and rules with no in-scope file', () => {
    const parked = { id: 'parked', instruction: 'x', enabled: false }
    const files = ['docs/b.md']
    expect(
      activeRules({ rules: [scoped, parked, 'plain rule'], files })
    ).toEqual(['plain rule'])
  })
})

describe('partitionByRuleScope', () => {
  const fp = Schema.decodeSync(Fingerprint)

  const findingOn = (file: string): Finding => ({
    severity: 'error',
    file,
    line: 1,
    rule: 'tenant-id',
    message: 'm',
    fingerprint: fp('aaaaaaaaaaaa')
  })

  it('keeps findings whose cited rule applies to their file', () => {
    const inScope = findingOn('src/modules/a.ts')
    const outside = findingOn('src/other/a.ts')
    expect(
      partitionByRuleScope({ rules: [scoped], findings: [inScope, outside] })
    ).toEqual({ applicable: [inScope], outOfScope: [outside] })
  })

  it('treats findings citing an unknown rule as out of scope', () => {
    const finding = { ...findingOn('src/modules/a.ts'), rule: 'unknown' }
    expect(
      partitionByRuleScope({ rules: [scoped], findings: [finding] })
    ).toEqual({ applicable: [], outOfScope: [finding] })
  })
})
