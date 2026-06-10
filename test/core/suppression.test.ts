import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import {
  filterSuppressed,
  parseSuppressions
} from '../../src/core/suppression.js'
import { Finding, Fingerprint } from '../../src/domain/finding.js'
import { isErr, isOk } from '../../src/core/result.js'

const fp = Schema.decodeSync(Fingerprint)

const finding = (fingerprint: string): Finding => ({
  severity: 'warning',
  file: 'src/a.ts',
  line: 1,
  rule: 'r',
  message: 'm',
  fingerprint: fp(fingerprint)
})

describe('parseSuppressions', () => {
  it('parses fingerprints, comments, and blank lines', () => {
    const result = parseSuppressions(
      '# header comment\na94f3c21e0b7  # architect: false positive\n\nbeefbeefbeef\n'
    )
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.fingerprints).toEqual(['a94f3c21e0b7', 'beefbeefbeef'])
    }
  })

  it('parses an empty file to an empty list', () => {
    const result = parseSuppressions('')
    expect(isOk(result) && result.value.fingerprints.length === 0).toBe(true)
  })

  it('rejects non-hex entries with a ConfigError', () => {
    const result = parseSuppressions('not-a-hash\n')
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error._tag).toBe('ConfigError')
      expect(result.error.message).toContain('not-a-hash')
    }
  })
})

describe('filterSuppressed', () => {
  it('drops suppressed findings and reports their fingerprints', () => {
    const a = finding('a94f3c21e0b7')
    const b = finding('beefbeefbeef')
    const result = filterSuppressed({
      findings: [a, b],
      suppressions: { fingerprints: [fp('beefbeefbeef')] }
    })
    expect(result.kept).toEqual([a])
    expect(result.suppressed).toEqual(['beefbeefbeef'])
  })

  it('keeps everything when nothing is suppressed', () => {
    const a = finding('a94f3c21e0b7')
    const result = filterSuppressed({
      findings: [a],
      suppressions: { fingerprints: [] }
    })
    expect(result.kept).toEqual([a])
    expect(result.suppressed).toEqual([])
  })
})
