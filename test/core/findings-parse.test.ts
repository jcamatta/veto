import { describe, expect, it } from 'vitest'
import { parseFindings } from '../../src/core/findings-parse.js'
import { isErr, isOk } from '../../src/core/result.js'

const valid = JSON.stringify({
  findings: [
    {
      severity: 'warning',
      file: 'src/a.ts',
      line: 3,
      rule: 'r1',
      message: 'm1'
    }
  ]
})

describe('parseFindings', () => {
  it('parses a pure JSON object', () => {
    const result = parseFindings(valid)
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.findings).toHaveLength(1)
      expect(result.value.findings[0]?.severity).toBe('warning')
    }
  })

  it('parses the trailing JSON object after prose', () => {
    const result = parseFindings(`I reviewed the diff {carefully}.\n\n${valid}`)
    expect(isOk(result)).toBe(true)
  })

  it('tolerates a trailing markdown fence', () => {
    const result = parseFindings('```json\n' + valid + '\n```')
    expect(isOk(result)).toBe(true)
  })

  it('parses an empty findings array', () => {
    const result = parseFindings('{"findings": []}')
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.value.findings).toHaveLength(0)
    }
  })

  it('fails on null text', () => {
    const result = parseFindings(null)
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error._tag).toBe('FindingsParseError')
      expect(result.error.message).toContain('no result text')
    }
  })

  it('fails when no JSON object is present', () => {
    const result = parseFindings('all good, nothing to report')
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error.message).toContain('no JSON object')
    }
  })

  it('fails with the schema error when the shape is wrong', () => {
    const result = parseFindings('{"findings": [{"severity": "fatal"}]}')
    expect(isErr(result)).toBe(true)
    if (isErr(result)) {
      expect(result.error._tag).toBe('FindingsParseError')
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })
})
