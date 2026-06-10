import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { exitCode, isBlocking } from '../../src/core/exit-code.js'
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

describe('exitCode', () => {
  it('maps blocking to 1 and non-blocking to 0', () => {
    expect(exitCode(true)).toBe(1)
    expect(exitCode(false)).toBe(0)
  })
})
