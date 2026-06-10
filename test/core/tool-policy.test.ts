import { describe, expect, it } from 'vitest'
import { evaluateToolCall } from '../../src/core/tool-policy.js'

const base = {
  repoRoot: 'C:\\repo',
  runsDir: '.veto/runs',
  tool: 'Read',
  path: 'src/a.ts',
  scope: null
}

describe('evaluateToolCall', () => {
  it('allows Read, Grep, and Glob inside the repo', () => {
    expect(evaluateToolCall(base).allowed).toBe(true)
    expect(evaluateToolCall({ ...base, tool: 'Grep' }).allowed).toBe(true)
    expect(evaluateToolCall({ ...base, tool: 'Glob' }).allowed).toBe(true)
  })

  it('denies tools outside the allowlist', () => {
    const result = evaluateToolCall({ ...base, tool: 'Bash' })
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain('Bash')
    }
  })

  it('allows calls without a path', () => {
    expect(evaluateToolCall({ ...base, path: null }).allowed).toBe(true)
  })

  it('denies paths resolving outside the repo root', () => {
    const traversal = evaluateToolCall({ ...base, path: '..\\other\\secret' })
    const absolute = evaluateToolCall({ ...base, path: 'D:\\elsewhere\\x' })
    expect(traversal.allowed).toBe(false)
    expect(absolute.allowed).toBe(false)
  })

  it('allows absolute paths inside the repo root', () => {
    const result = evaluateToolCall({ ...base, path: 'C:\\repo\\src\\a.ts' })
    expect(result.allowed).toBe(true)
  })

  it('denies reads into .veto/runs/', () => {
    const dir = evaluateToolCall({ ...base, path: '.veto/runs' })
    const file = evaluateToolCall({
      ...base,
      path: '.veto/runs/latest.json'
    })
    expect(dir.allowed).toBe(false)
    expect(file.allowed).toBe(false)
  })

  it('allows other .veto files', () => {
    const result = evaluateToolCall({ ...base, path: '.veto/ignore' })
    expect(result.allowed).toBe(true)
  })

  it('denies the runs dir when given as an absolute path', () => {
    const result = evaluateToolCall({
      ...base,
      runsDir: 'C:\\repo\\.veto\\runs',
      path: '.veto/runs/latest.json'
    })
    expect(result.allowed).toBe(false)
  })

  it('ignores a runs dir outside the repo root', () => {
    const result = evaluateToolCall({
      ...base,
      runsDir: 'D:\\elsewhere\\runs',
      path: 'src/a.ts'
    })
    expect(result.allowed).toBe(true)
  })

  it('enforces strict scope when provided', () => {
    const inScope = evaluateToolCall({ ...base, scope: ['src/**'] })
    const outOfScope = evaluateToolCall({
      ...base,
      path: 'docs/SPEC.md',
      scope: ['src/**']
    })
    expect(inScope.allowed).toBe(true)
    expect(outOfScope.allowed).toBe(false)
  })

  it('allows the repo root itself', () => {
    const result = evaluateToolCall({ ...base, path: '.' })
    expect(result.allowed).toBe(true)
  })
})
