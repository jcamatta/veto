import { describe, expect, it } from 'vitest'
import { ruleKey, ruleKeys, ruleText } from '../../src/core/rules.js'

const identified = {
  id: 'process-boundary',
  instruction: 'no node apis in renderer'
}

describe('rule helpers', () => {
  it('uses the id as the key for identified rules', () => {
    expect(ruleKey(identified)).toBe('process-boundary')
  })

  it('uses the full text as the key for plain rules', () => {
    expect(ruleKey('no cross-layer imports')).toBe('no cross-layer imports')
  })

  it('extracts the text from both shapes', () => {
    expect(ruleText(identified)).toBe('no node apis in renderer')
    expect(ruleText('plain rule')).toBe('plain rule')
  })

  it('maps a mixed rule list to its keys', () => {
    expect(ruleKeys([identified, 'plain rule'])).toEqual([
      'process-boundary',
      'plain rule'
    ])
  })
})
