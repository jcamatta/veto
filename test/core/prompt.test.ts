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
  it('puts the persona and rules in the system text', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt.system).toContain(config.systemPrompt)
    expect(prompt.system).toContain('- keep domain logic out of UI components')
    expect(prompt.user).not.toContain(config.systemPrompt)
    expect(prompt.user).not.toContain('keep domain logic out of UI components')
  })

  it('puts the staged files and diff in the user text', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt.user).toContain('- src/a.ts')
    expect(prompt.user).toContain(diff.diffText)
    expect(prompt.system).not.toContain(diff.diffText)
  })

  it('renders identified rules with a bracketed id prefix', () => {
    const prompt = buildPrompt({
      config: {
        ...config,
        rules: [
          { id: 'no-cross-layer', instruction: 'no cross-layer imports' },
          'plain rule'
        ]
      },
      diff,
      baseline: null
    })
    expect(prompt.system).toContain('- [no-cross-layer] no cross-layer imports')
    expect(prompt.system).toContain('- plain rule')
  })

  it('always ends the user text with the strict JSON instruction', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt.user).toContain('{"findings": []}')
    expect(prompt.user.indexOf('"severity"')).toBeGreaterThan(
      prompt.user.indexOf(diff.diffText)
    )
  })

  it('omits the baseline section without a baseline', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    expect(prompt.user).not.toContain('Previous findings')
  })

  it('injects previous findings and Layer-2 instructions with a baseline', () => {
    const prompt = buildPrompt({ config, diff, baseline })
    expect(prompt.user).toContain('Previous findings (attempt 2)')
    expect(prompt.user).toContain('a94f3c21e0b7')
    expect(prompt.user).toContain('state whether it is now resolved')
    expect(prompt.user).toContain('No flip-flopping')
  })
})

describe('appendParseRetry', () => {
  it('appends the validation error after the original user prompt', () => {
    const prompt = buildPrompt({ config, diff, baseline: null })
    const retried = appendParseRetry({
      prompt: prompt.user,
      message: 'Expected "error"'
    })
    expect(retried.startsWith(prompt.user)).toBe(true)
    expect(retried).toContain('failed validation: Expected "error"')
    expect(retried).toContain('Emit only a single valid JSON object')
  })
})
