import { describe, expect, it } from 'vitest'
import { resultText } from '../../src/core/agent-output.js'

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
