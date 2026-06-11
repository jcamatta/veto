import { describe, expect, it } from 'vitest'
import { configJsonSchema } from '../../src/core/config-json-schema.js'

type SchemaObject = {
  readonly type?: string
  readonly required?: readonly string[]
  readonly properties?: Record<string, unknown>
  readonly additionalProperties?: boolean
}

const root = configJsonSchema as SchemaObject

describe('configJsonSchema', () => {
  it('is an object schema rejecting unknown keys', () => {
    expect(root.type).toBe('object')
    expect(root.additionalProperties).toBe(false)
  })

  it('requires the mandatory reviewer fields', () => {
    expect(root.required).toEqual(
      expect.arrayContaining(['name', 'mode', 'paths', 'systemPrompt', 'rules'])
    )
  })

  it('exposes the mode and effort enums', () => {
    const properties = root.properties ?? {}
    expect(properties.mode).toMatchObject({
      enum: ['static', 'runtime']
    })
    expect(properties.effort).toMatchObject({
      enum: ['low', 'medium', 'high', 'xhigh', 'max']
    })
  })

  it('keeps the optional knobs as non-required properties', () => {
    const keys = Object.keys(root.properties ?? {})
    const optional = ['ignore', 'model', 'effort', 'maxTurns', 'timeoutMs']
    expect(keys).toEqual(expect.arrayContaining(optional))
    optional.forEach((knob) => {
      expect(root.required).not.toContain(knob)
    })
  })

  it('does not silently degrade to an unconstrained schema', () => {
    expect(Object.keys(root.properties ?? {}).length).toBeGreaterThan(0)
  })
})
