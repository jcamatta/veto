import { describe, expect, it } from 'vitest'
import {
  resultText,
  structuredOutput,
  structuredRetriesExhausted
} from '../../src/core/agent-output.js'

describe('resultText', () => {
  it('returns null when there are no messages', () => {
    expect(resultText([])).toBeNull()
  })

  it('extracts the result string from a result-shaped message', () => {
    const raws = [
      { type: 'system', subtype: 'init' },
      { type: 'assistant', message: { content: [] } },
      { type: 'result', subtype: 'success', result: '{"findings":[]}' }
    ]
    expect(resultText(raws)).toBe('{"findings":[]}')
  })

  it('keeps the last result message when several appear', () => {
    const raws = [
      { type: 'result', result: 'first' },
      { type: 'result', result: 'second' }
    ]
    expect(resultText(raws)).toBe('second')
  })

  it('ignores non-objects, null, and malformed shapes', () => {
    const raws = [
      null,
      42,
      'text',
      { type: 'result' },
      { type: 'result', result: 7 },
      { result: 'orphan' }
    ]
    expect(resultText(raws)).toBeNull()
  })
})

describe('structuredOutput', () => {
  it('returns the structured_output of the last result message', () => {
    const raws = [
      { type: 'system' },
      { type: 'result', subtype: 'success', structured_output: { findings: [] } }
    ]
    expect(structuredOutput(raws)).toEqual({ findings: [] })
  })

  it('returns undefined when no result message carries structured output', () => {
    expect(structuredOutput([{ type: 'result', result: 'text' }])).toBeUndefined()
    expect(structuredOutput([])).toBeUndefined()
  })
})

describe('structuredRetriesExhausted', () => {
  it('detects the error_max_structured_output_retries subtype', () => {
    const raws = [
      { type: 'result', subtype: 'error_max_structured_output_retries' }
    ]
    expect(structuredRetriesExhausted(raws)).toBe(true)
  })

  it('is false for successful or absent result messages', () => {
    expect(
      structuredRetriesExhausted([{ type: 'result', subtype: 'success' }])
    ).toBe(false)
    expect(structuredRetriesExhausted([])).toBe(false)
  })
})
