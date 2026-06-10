import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { Effect } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { resolveRepoRoot } from '../../src/cli/repo-root.js'
import type { GitError } from '../../src/domain/errors.js'

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'veto-root-'))

const initRepo = (): string => {
  const dir = tempDir()
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'pipe' })
  return dir
}

const resolve = (cwd: string): Promise<string> =>
  Effect.runPromise(
    resolveRepoRoot(cwd).pipe(Effect.provide(NodeContext.layer))
  )

const resolveError = (cwd: string): Promise<GitError> =>
  Effect.runPromise(
    Effect.flip(resolveRepoRoot(cwd)).pipe(Effect.provide(NodeContext.layer))
  )

describe('resolveRepoRoot', () => {
  it('resolves the repository toplevel from inside the repo', async () => {
    const dir = initRepo()
    const root = await resolve(dir)
    expect(basename(root)).toBe(basename(dir))
    expect(root.length).toBeGreaterThan(0)
  })

  it('resolves the toplevel from a subdirectory of the repo', async () => {
    const dir = initRepo()
    const sub = join(dir, 'nested')
    mkdirSync(sub)
    const root = await resolve(sub)
    expect(basename(root)).toBe(basename(dir))
  })

  it('fails with GitError outside a git repository', async () => {
    const dir = tempDir()
    const error = await resolveError(dir)
    expect(error._tag).toBe('GitError')
    expect(error.message).toContain('not a git repository')
  })
})
