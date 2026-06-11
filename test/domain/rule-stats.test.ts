import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { RuleStats, RuleStatsReport } from '../../src/domain/rule-stats.js'

const decodeStats = Schema.decodeUnknownEither(RuleStats)

const decodeReport = Schema.decodeUnknownEither(RuleStatsReport)

const stats = {
  rule: 'one-file-one-responsibility',
  fired: 4,
  suppressed: 1,
  severities: { error: 2, warning: 2, info: 0 },
  lastHead: 'abc123'
}

describe('RuleStats', () => {
  it('decodes a valid aggregate', () => {
    expect(decodeStats(stats)).toEqual(Either.right(stats))
  })

  it('accepts a plain rule text as the rule key', () => {
    const plain = { ...stats, rule: 'No duplicated logic across modules.' }
    expect(Either.isRight(decodeStats(plain))).toBe(true)
  })

  it('rejects negative and fractional counts', () => {
    expect(Either.isLeft(decodeStats({ ...stats, fired: -1 }))).toBe(true)
    expect(Either.isLeft(decodeStats({ ...stats, suppressed: 0.5 }))).toBe(true)
  })

  it('rejects a blank last head', () => {
    expect(Either.isLeft(decodeStats({ ...stats, lastHead: ' ' }))).toBe(true)
  })
})

describe('RuleStatsReport', () => {
  it('decodes a report with its prune window', () => {
    const report = { retainedHeads: 10, rules: [stats] }
    expect(decodeReport(report)).toEqual(Either.right(report))
  })

  it('rejects a non-positive prune window', () => {
    expect(Either.isLeft(decodeReport({ retainedHeads: 0, rules: [] }))).toBe(
      true
    )
  })
})
