import { describe, expect, it } from 'vitest'
import { scopeDiff } from '../../src/core/diff-scope.js'
import type { ReviewerConfig } from '../../src/domain/reviewer-config.js'

const config: ReviewerConfig = {
  name: 'frontend',
  mode: 'static',
  paths: ['src/renderer/**'],
  ignore: ['**/*.test.ts'],
  systemPrompt: 'You review the renderer.',
  rules: ['no node apis in renderer']
}

const fileDiff = (file: string): string =>
  [
    `diff --git a/${file} b/${file}`,
    'index 0000000..1111111 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1,1 +1,2 @@',
    ' const a = 1',
    '+const b = 2'
  ].join('\n')

const diff = {
  diffText: [
    fileDiff('src/renderer/App.tsx'),
    fileDiff('src/main/ipc.ts'),
    fileDiff('src/renderer/util.test.ts')
  ].join('\n'),
  files: ['src/renderer/App.tsx', 'src/main/ipc.ts', 'src/renderer/util.test.ts']
}

describe('scopeDiff', () => {
  it('keeps only hunks for files matching paths minus ignore', () => {
    const scoped = scopeDiff({ config, diff })
    expect(scoped.diffText).toContain('b/src/renderer/App.tsx')
    expect(scoped.diffText).not.toContain('src/main/ipc.ts')
    expect(scoped.diffText).not.toContain('util.test.ts')
  })

  it('reports only in-scope files in the file list', () => {
    const scoped = scopeDiff({ config, diff })
    expect(scoped.files).toEqual(['src/renderer/App.tsx'])
  })

  it('returns the full segment content for kept files', () => {
    const scoped = scopeDiff({ config, diff })
    expect(scoped.diffText).toBe(fileDiff('src/renderer/App.tsx'))
  })

  it('keeps text without a parseable diff header (fail-safe)', () => {
    const scoped = scopeDiff({
      config,
      diff: { diffText: 'not a diff at all', files: ['src/renderer/App.tsx'] }
    })
    expect(scoped.diffText).toBe('not a diff at all')
  })

  it('keeps preamble lines before the first segment', () => {
    const scoped = scopeDiff({
      config,
      diff: {
        diffText: `warning: something\n${fileDiff('src/renderer/App.tsx')}`,
        files: ['src/renderer/App.tsx']
      }
    })
    expect(scoped.diffText).toContain('warning: something')
    expect(scoped.diffText).toContain('b/src/renderer/App.tsx')
  })

  it('is the identity for a fully in-scope diff', () => {
    const only = { diffText: fileDiff('src/renderer/App.tsx'), files: ['src/renderer/App.tsx'] }
    expect(scopeDiff({ config, diff: only }).diffText).toBe(only.diffText)
  })
})
