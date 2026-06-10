import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { parse } from 'yaml'
import { ReviewerConfig } from '../../src/domain/reviewer-config.js'

const decode = Schema.decodeUnknownEither(ReviewerConfig)

const valid = {
  name: 'architect',
  mode: 'static',
  paths: ['src/**/*.ts'],
  ignore: ['**/*.test.ts'],
  systemPrompt: 'You are a software architect.',
  rules: ['no cross-layer imports']
}

describe('ReviewerConfig', () => {
  it('decodes a valid config', () => {
    const result = decode(valid)
    expect(Either.isRight(result)).toBe(true)
  })

  it('defaults ignore to an empty array', () => {
    const rest = Object.fromEntries(
      Object.entries(valid).filter(([key]) => key !== 'ignore')
    )
    const result = decode(rest)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.ignore).toEqual([])
    }
  })

  it('accepts mode runtime in the schema (seam reserved for v2)', () => {
    const result = decode({ ...valid, mode: 'runtime' })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects an unknown mode', () => {
    const result = decode({ ...valid, mode: 'hybrid' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects an empty paths array', () => {
    const result = decode({ ...valid, paths: [] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = decode({ ...valid, name: '  ' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects empty rules', () => {
    const result = decode({ ...valid, rules: [] })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('accepts optional model, effort, maxTurns, and timeoutMs knobs', () => {
    const result = decode({
      ...valid,
      model: 'claude-sonnet-4-6',
      effort: 'medium',
      maxTurns: 8,
      timeoutMs: 240000
    })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.model).toBe('claude-sonnet-4-6')
      expect(result.right.effort).toBe('medium')
    }
  })

  it('rejects an unknown effort level', () => {
    const result = decode({ ...valid, effort: 'turbo' })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects a non-positive timeout', () => {
    const result = decode({ ...valid, timeoutMs: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('decodes a config parsed from YAML', () => {
    const yaml = [
      'name: architect',
      'mode: static',
      'paths:',
      '  - "src/**/*.ts"',
      'ignore:',
      '  - "**/*.test.ts"',
      'systemPrompt: |',
      '  You are a software architect reviewing a staged diff.',
      'rules:',
      '  - keep domain logic out of UI components',
      '  - no cross-layer imports'
    ].join('\n')
    const result = decode(parse(yaml))
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.name).toBe('architect')
      expect(result.right.rules).toHaveLength(2)
    }
  })

  it('rejects a YAML config missing systemPrompt', () => {
    const yaml = ['name: architect', 'mode: static', 'paths:', '  - "src/**"', 'rules:', '  - a rule'].join('\n')
    const result = decode(parse(yaml))
    expect(Either.isLeft(result)).toBe(true)
  })
})
