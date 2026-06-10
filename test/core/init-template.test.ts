import { Either, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import type { Stack } from '../../src/core/init-detect.js'
import {
  agentSnippet,
  renderStarterConfig
} from '../../src/core/init-template.js'
import { ReviewerConfig } from '../../src/domain/reviewer-config.js'

const decode = Schema.decodeUnknownEither(ReviewerConfig)

const stacks: readonly Stack[] = ['node', 'react', 'next', 'electron']

describe('renderStarterConfig', () => {
  it.each(stacks)('renders a decodable reviewer config for %s', (stack) => {
    const decoded = decode(parse(renderStarterConfig(stack)))
    expect(Either.isRight(decoded)).toBe(true)
  })

  it.each(stacks)('carries the cost-tuned defaults for %s', (stack) => {
    const decoded = decode(parse(renderStarterConfig(stack)))
    if (Either.isLeft(decoded)) {
      expect.fail(decoded.left.message)
    }
    expect(decoded.right.model).toBe('claude-sonnet-4-6')
    expect(decoded.right.effort).toBe('low')
    expect(decoded.right.maxTurns).toBe(8)
    expect(decoded.right.mode).toBe('static')
  })

  it('shapes the paths and rules to the detected stack', () => {
    const electron = decode(parse(renderStarterConfig('electron')))
    if (Either.isLeft(electron)) {
      expect.fail(electron.left.message)
    }
    expect(electron.right.paths).toContain('electron/**/*.ts')
    expect(
      electron.right.rules.some(
        (rule) => typeof rule !== 'string' && rule.id === 'ipc-validation'
      )
    ).toBe(true)
  })

  it('tells the user the rules are placeholders to replace', () => {
    expect(renderStarterConfig('node')).toContain('replace them')
  })

  it('instructs bounded reading in the system prompt', () => {
    const decoded = decode(parse(renderStarterConfig('node')))
    if (Either.isLeft(decoded)) {
      expect.fail(decoded.left.message)
    }
    expect(decoded.right.systemPrompt).toContain('read a file at most once')
    expect(decoded.right.systemPrompt).toContain('never read')
  })
})

describe('agentSnippet', () => {
  it('points the blocked agent at the latest run report', () => {
    expect(agentSnippet).toContain('.veto/runs/latest.json')
  })
})
