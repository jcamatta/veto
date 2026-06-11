import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { partitionByRuleScope } from '../../src/core/finding-scope.js'
import { Fingerprint, type Finding } from '../../src/domain/finding.js'

const fp = Schema.decodeSync(Fingerprint)

const scoped = {
  id: 'tenant-id',
  instruction: 'every query carries the tenant id',
  paths: ['src/modules/**'] as const,
  ignore: ['**/*.spec.ts']
}

const findingOn = (file: string): Finding => ({
  severity: 'error',
  file,
  line: 1,
  rule: 'tenant-id',
  message: 'm',
  fingerprint: fp('aaaaaaaaaaaa')
})

describe('partitionByRuleScope', () => {
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

  it('keeps findings citing plain string rules anywhere', () => {
    const finding = { ...findingOn('anywhere/a.ts'), rule: 'plain rule' }
    expect(
      partitionByRuleScope({ rules: ['plain rule'], findings: [finding] })
    ).toEqual({ applicable: [finding], outOfScope: [] })
  })
})
