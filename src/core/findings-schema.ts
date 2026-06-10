import { JSONSchema } from 'effect'
import { ModelFindings } from '../domain/finding.js'
import type { ReviewerRule } from '../domain/reviewer-config.js'
import { ruleKeys } from './rules.js'

type JsonRecord = Record<string, unknown>

type WalkInput = {
  readonly node: unknown
  readonly keys: readonly string[]
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const walk = ({ node, keys }: WalkInput): unknown => {
  if (Array.isArray(node)) {
    return node.map((item) => walk({ node: item, keys }))
  }
  if (!isRecord(node)) {
    return node
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      const walked = walk({ node: value, keys })
      const patchable = key === 'properties' && isRecord(walked)
      return [
        key,
        patchable && 'rule' in walked
          ? { ...walked, rule: { type: 'string', enum: [...keys] } }
          : walked
      ]
    })
  )
}

const findingsSchemaFor = (
  rules: readonly ReviewerRule[]
): Record<string, unknown> => {
  const base: JsonRecord = { ...JSONSchema.make(ModelFindings) }
  const patched = walk({ node: base, keys: ruleKeys(rules) })
  return isRecord(patched) ? patched : base
}

export { findingsSchemaFor }
