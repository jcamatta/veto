import { describe, expect, it } from 'vitest'
import {
  enabledRules,
  ruleEnabled,
  ruleKey,
  ruleKeys,
  ruleText
} from '../../src/core/rules.js'

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

  it('treats plain rules and rules without the knob as enabled', () => {
    expect(ruleEnabled('plain rule')).toBe(true)
    expect(ruleEnabled(identified)).toBe(true)
    expect(ruleEnabled({ ...identified, enabled: true })).toBe(true)
    expect(ruleEnabled({ ...identified, enabled: false })).toBe(false)
  })

  it('filters disabled rules out of the list', () => {
    const parked = { id: 'parked', instruction: 'x', enabled: false }
    expect(enabledRules([identified, parked, 'plain rule'])).toEqual([
      identified,
      'plain rule'
    ])
  })
})
