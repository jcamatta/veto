import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { blocksAt, exitCode, isBlocking } from '../../src/core/exit-code.js'
import { Finding, Fingerprint, Severity } from '../../src/domain/finding.js'
import { ReviewerOutcome } from '../../src/domain/latest-projection.js'

const fp = Schema.decodeSync(Fingerprint)

const outcome = (severity: Severity): ReviewerOutcome => ({
  name: 'a',
  status: 'completed',
  findings: [
    {
      severity,
      file: 'src/a.ts',
      line: null,
      rule: 'r',
      message: 'm',
      fingerprint: fp('aaaaaaaaaaaa')
    } satisfies Finding
  ],
  resolved: []
})

describe('isBlocking', () => {
  it('blocks on any error-severity finding', () => {
    expect(isBlocking([outcome('warning'), outcome('error')])).toBe(true)
  })

  it('does not block on warnings or info alone', () => {
    expect(isBlocking([outcome('warning'), outcome('info')])).toBe(false)
  })

  it('does not block with no reviewers', () => {
    expect(isBlocking([])).toBe(false)
  })
})

describe('blocksAt', () => {
  it('at error blocks only on error findings', () => {
    expect(blocksAt('error')([outcome('error')])).toBe(true)
    expect(blocksAt('error')([outcome('warning')])).toBe(false)
    expect(blocksAt('error')([outcome('info')])).toBe(false)
  })

  it('at warning blocks on warning and error findings', () => {
    expect(blocksAt('warning')([outcome('error')])).toBe(true)
    expect(blocksAt('warning')([outcome('warning')])).toBe(true)
    expect(blocksAt('warning')([outcome('info')])).toBe(false)
  })

  it('at info blocks on any finding', () => {
    expect(blocksAt('info')([outcome('error')])).toBe(true)
    expect(blocksAt('info')([outcome('warning')])).toBe(true)
    expect(blocksAt('info')([outcome('info')])).toBe(true)
  })

  it('at never blocks on nothing', () => {
    expect(blocksAt('never')([outcome('error')])).toBe(false)
    expect(blocksAt('never')([outcome('warning')])).toBe(false)
    expect(blocksAt('never')([outcome('info')])).toBe(false)
  })

  it('never blocks without findings, at any threshold', () => {
    expect(blocksAt('info')([])).toBe(false)
    expect(
      blocksAt('info')([{ name: 'a', status: 'skipped', findings: [], resolved: [] }])
    ).toBe(false)
  })
})

describe('exitCode', () => {
  it('maps blocking to 1 and non-blocking to 0', () => {
    expect(exitCode(true)).toBe(1)
    expect(exitCode(false)).toBe(0)
  })
})
