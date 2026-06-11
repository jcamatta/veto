import { describe, expect, it } from 'vitest'
import { findingsSchemaFor } from '../../src/core/findings-schema.js'

const get =
  (node: unknown) =>
  (key: string): unknown =>
    typeof node === 'object' && node !== null
      ? (node as Record<string, unknown>)[key]
      : undefined

const ruleEnumOf = (schema: Record<string, unknown>): unknown =>
  ['properties', 'findings', 'items', 'properties', 'rule'].reduce<unknown>(
    (acc, key) => get(acc)(key),
    schema
  )

describe('findingsSchemaFor', () => {
  it('constrains the rule property to the config rule keys', () => {
    const schema = findingsSchemaFor([
      { id: 'process-boundary', instruction: 'no node apis in renderer' },
      'plain rule text'
    ])
    expect(ruleEnumOf(schema)).toEqual({
      type: 'string',
      enum: ['process-boundary', 'plain rule text']
    })
  })

  it('uses the literal text as the enum entry for plain rules', () => {
    const schema = findingsSchemaFor(['only rule'])
    expect(ruleEnumOf(schema)).toEqual({ type: 'string', enum: ['only rule'] })
  })

  it('keeps the rest of the findings schema intact', () => {
    const schema = findingsSchemaFor(['a rule'])
    const text = JSON.stringify(schema)
    expect(text).toContain('"severity"')
    expect(text).toContain('"message"')
    expect(text).toContain('"required"')
  })
})
