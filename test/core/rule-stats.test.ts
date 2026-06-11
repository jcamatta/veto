import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { foldRuleStats } from '../../src/core/rule-stats.js'
import { Finding, Fingerprint, type Severity } from '../../src/domain/finding.js'
import {
  FindingsDecoded,
  FindingSuppressed,
  ReplayServed
} from '../../src/domain/review-event.js'
import type { StoredEvent } from '../../src/domain/stored-event.js'

const finding = (input: {
  readonly rule: string
  readonly severity?: Severity
  readonly fingerprint?: string
}): Finding =>
  Schema.decodeUnknownSync(Finding)({
    severity: input.severity ?? 'warning',
    file: 'src/a.ts',
    line: 1,
    rule: input.rule,
    message: 'm',
    fingerprint: input.fingerprint ?? 'abc123'
  })

const decoded = (input: {
  readonly head: string
  readonly findings: readonly Finding[]
}): StoredEvent => ({
  head: input.head,
  reviewer: 'architect',
  event: FindingsDecoded.make({ reviewer: 'architect', findings: input.findings })
})

const suppressed = (input: {
  readonly head: string
  readonly fingerprint: string
}): StoredEvent => ({
  head: input.head,
  reviewer: 'architect',
  event: FindingSuppressed.make({
    reviewer: 'architect',
    fingerprint: Schema.decodeUnknownSync(Fingerprint)(input.fingerprint)
  })
})

describe('foldRuleStats', () => {
  it('returns nothing for an empty history', () => {
    expect(foldRuleStats([])).toEqual([])
  })

  it('counts fires and severities per rule and tracks the last head', () => {
    const stats = foldRuleStats([
      decoded({
        head: 'h1',
        findings: [
          finding({ rule: 'no-dup', severity: 'error' }),
          finding({ rule: 'no-dup', severity: 'warning', fingerprint: 'abc124' })
        ]
      }),
      decoded({
        head: 'h2',
        findings: [finding({ rule: 'no-dup', severity: 'error' })]
      })
    ])
    expect(stats).toEqual([
      {
        rule: 'no-dup',
        fired: 3,
        suppressed: 0,
        severities: { error: 2, warning: 1, info: 0 },
        lastHead: 'h2'
      }
    ])
  })

  it('attributes suppressions to the rule of the suppressed fingerprint', () => {
    const stats = foldRuleStats([
      decoded({ head: 'h1', findings: [finding({ rule: 'no-dup' })] }),
      suppressed({ head: 'h1', fingerprint: 'abc123' })
    ])
    expect(stats[0]?.suppressed).toBe(1)
    expect(stats[0]?.fired).toBe(1)
  })

  it('ignores suppressions whose fingerprint never fired', () => {
    const stats = foldRuleStats([
      decoded({ head: 'h1', findings: [finding({ rule: 'no-dup' })] }),
      suppressed({ head: 'h1', fingerprint: 'ffffff' })
    ])
    expect(stats[0]?.suppressed).toBe(0)
  })

  it('aggregates plain rule texts as their own keys', () => {
    const stats = foldRuleStats([
      decoded({
        head: 'h1',
        findings: [
          finding({ rule: 'One file, one responsibility.' }),
          finding({ rule: 'kebab-id', fingerprint: 'abc124' })
        ]
      })
    ])
    expect(stats.map((s) => s.rule)).toEqual([
      'One file, one responsibility.',
      'kebab-id'
    ])
  })

  it('sorts by fired descending then rule and ignores unrelated events', () => {
    const stats = foldRuleStats([
      {
        head: 'h1',
        reviewer: 'architect',
        event: ReplayServed.make({ reviewer: 'architect' })
      },
      decoded({
        head: 'h1',
        findings: [
          finding({ rule: 'b-rule' }),
          finding({ rule: 'a-rule', fingerprint: 'abc124' }),
          finding({ rule: 'b-rule', fingerprint: 'abc125' })
        ]
      })
    ])
    expect(stats.map((s) => s.rule)).toEqual(['b-rule', 'a-rule'])
  })
})
