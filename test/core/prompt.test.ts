import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { appendParseRetry, buildPrompt } from '../../src/core/prompt.js'
import { Fingerprint } from '../../src/domain/finding.js'
import { ReviewerConfig } from '../../src/domain/reviewer-config.js'

const fp = Schema.decodeSync(Fingerprint)

const config: ReviewerConfig = {
  name: 'architect',
  mode: 'static',
  paths: ['src/**/*.ts'],
  ignore: [],
  systemPrompt: 'You are a software architect reviewing a staged diff.',
  rules: ['keep domain logic out of UI components', 'no cross-layer imports']
}

const diff = {
  diffText: '+++ b/src/a.ts\n+const x = 1',
  files: ['src/a.ts']
}

const baseline = {
  attempt: 2,
  findings: [
    {
      severity: 'error' as const,
      file: 'src/a.ts',
      line: 1,
      rule: 'no cross-layer imports',
      message: 'bad import',
      fingerprint: fp('a94f3c21e0b7')
    }
  ]
}

describe('buildPrompt', () => {
  it('includes system prompt, rules, files, and diff', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt).toContain(config.systemPrompt)
    expect(prompt).toContain('- keep domain logic out of UI components')
    expect(prompt).toContain('- src/a.ts')
    expect(prompt).toContain(diff.diffText)
  })

  it('always ends with the strict JSON instruction', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt).toContain('{"findings": []}')
    expect(prompt.indexOf('"severity"')).toBeGreaterThan(
      prompt.indexOf(diff.diffText)
    )
  })

  it('omits the baseline section without a baseline', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt).not.toContain('Previous findings')
  })

  it('injects previous findings and Layer-2 instructions with a baseline', () => {
    const prompt = buildPrompt({ config, diff, baseline })
    expect(prompt).toContain('Previous findings (attempt 2)')
    expect(prompt).toContain('a94f3c21e0b7')
    expect(prompt).toContain('state whether it is now resolved')
    expect(prompt).toContain('No flip-flopping')
  })
})

describe('appendParseRetry', () => {
  it('appends the validation error after the original prompt', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    const retried = appendParseRetry({ prompt, message: 'Expected "error"' })
    expect(retried.startsWith(prompt)).toBe(true)
    expect(retried).toContain('failed validation: Expected "error"')
    expect(retried).toContain('Emit only a single valid JSON object')
  })
})
