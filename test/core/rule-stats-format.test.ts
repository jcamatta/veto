import { describe, expect, it } from 'vitest'
import { renderRuleStats } from '../../src/core/rule-stats-format.js'
import type { RuleStats } from '../../src/domain/rule-stats.js'

const noisy: RuleStats = {
  rule: 'one-file-one-responsibility',
  fired: 12,
  suppressed: 3,
  severities: { error: 8, warning: 4, info: 0 },
  lastHead: 'abc1234def5678'
}

const quiet: RuleStats = {
  rule: 'no-dup',
  fired: 1,
  suppressed: 0,
  severities: { error: 0, warning: 1, info: 0 },
  lastHead: 'bbb2222'
}

describe('renderRuleStats', () => {
  it('renders one aligned line per rule with a header', () => {
    const text = renderRuleStats({ rules: [noisy, quiet], retainedHeads: 10 })
    const [header, first, second] = text.split('\n')
    expect(header).toBe(
      'rule                         fired  suppressed  error  warning  info  last seen'
    )
    expect(first).toBe(
      'one-file-one-responsibility     12           3      8        4     0  abc1234'
    )
    expect(second).toBe(
      'no-dup                           1           0      0        1     0  bbb2222'
    )
  })

  it('states the prune window', () => {
    const text = renderRuleStats({ rules: [quiet], retainedHeads: 10 })
    expect(text).toContain(
      'window: last 10 heads of run history (older runs are pruned)'
    )
  })

  it('truncates the last-seen head to a short sha', () => {
    const text = renderRuleStats({ rules: [noisy], retainedHeads: 10 })
    expect(text).toContain('abc1234')
    expect(text).not.toContain('abc1234def')
  })

  it('renders a friendly empty state with the window note', () => {
    const text = renderRuleStats({ rules: [], retainedHeads: 10 })
    expect(text).toBe(
      'no findings recorded yet — window: last 10 heads of run history (older runs are pruned)\n'
    )
  })
})
