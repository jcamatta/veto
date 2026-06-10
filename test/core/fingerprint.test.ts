import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  fingerprintFinding,
  normalizeSnippet
} from '../../src/core/fingerprint.js'
import { ModelFinding } from '../../src/domain/finding.js'
import { fakeHash } from './fake-hash.js'

const finding: ModelFinding = {
  severity: 'error',
  file: 'src/api/users.ts',
  line: 42,
  rule: 'no cross-layer imports',
  message: 'UI component imports the repository directly.'
}

describe('normalizeSnippet', () => {
  it('strips all whitespace', () => {
    expect(normalizeSnippet('a b\tc\nd')).toBe('abcd')
  })

  it('strips leading line numbers', () => {
    expect(normalizeSnippet('42: const x = 1')).toBe('constx=1')
    expect(normalizeSnippet('  7) foo()')).toBe('foo()')
  })

  it('is idempotent (property)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeSnippet(normalizeSnippet(s))).toBe(normalizeSnippet(s))
      })
    )
  })

  it('is invariant under extra whitespace (property)', () => {
    const letters = fc
      .array(fc.constantFrom('a', 'b', 'c', 'x', 'y', 'z'), { minLength: 1 })
      .map((chars) => chars.join(''))
    fc.assert(
      fc.property(letters, (s) => {
        const padded = s.split('').join(' ')
        expect(normalizeSnippet(padded)).toBe(normalizeSnippet(s))
      })
    )
  })
})

describe('fingerprintFinding', () => {
  it('attaches a 12-char hex fingerprint', () => {
    const result = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding
    })
    expect(result.fingerprint).toMatch(/^[0-9a-f]{12}$/)
    expect(result.message).toBe(finding.message)
  })

  it('is stable when the message shifts line numbers', () => {
    const a = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding: { ...finding, message: '12: bad import' }
    })
    const b = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding: { ...finding, message: '99: bad import' }
    })
    expect(a.fingerprint).toBe(b.fingerprint)
  })

  it('differs per reviewer', () => {
    const a = fingerprintFinding({ hash: fakeHash, reviewer: 'a', finding })
    const b = fingerprintFinding({ hash: fakeHash, reviewer: 'b', finding })
    expect(a.fingerprint).not.toBe(b.fingerprint)
  })

  it('differs per rule and file', () => {
    const base = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding
    })
    const otherRule = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding: { ...finding, rule: 'other rule' }
    })
    const otherFile = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding: { ...finding, file: 'src/other.ts' }
    })
    expect(base.fingerprint).not.toBe(otherRule.fingerprint)
    expect(base.fingerprint).not.toBe(otherFile.fingerprint)
  })
})
