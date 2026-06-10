import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Exit } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { commandGit } from '../../src/adapters/command-git.js'
import { emptyRepoSentinel } from '../../src/domain/run-key.js'
import { Git, type GitService } from '../../src/ports/git.js'

const git = (cwd: string, args: readonly string[]): void => {
  execFileSync('git', [...args], { cwd, stdio: 'pipe' })
}

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'veto-git-'))

const initRepo = (): string => {
  const dir = tempDir()
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  return dir
}

const repoWithStagedChange = (): string => {
  const dir = initRepo()
  writeFileSync(join(dir, 'a.txt'), 'first line\n')
  git(dir, ['add', 'a.txt'])
  git(dir, ['commit', '-m', 'initial'])
  writeFileSync(join(dir, 'a.txt'), 'first line\nstaged line\n')
  git(dir, ['add', 'a.txt'])
  return dir
}

const run = <A, E>(
  cwd: string,
  use: (service: GitService) => Effect.Effect<A, E>
): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(
    Effect.flatMap(Git, use).pipe(
      Effect.provide(commandGit({ cwd })),
      Effect.provide(NodeContext.layer)
    )
  )

const succeed = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) {
    return exit.value
  }
  throw new Error(`expected success, got ${String(exit.cause)}`)
}

describe('commandGit', () => {
  it('returns the staged diff text and file list', async () => {
    const dir = repoWithStagedChange()
    const diff = succeed(await run(dir, (s) => s.stagedDiff))
    expect(diff.files).toEqual(['a.txt'])
    expect(diff.diffText).toContain('+staged line')
  })

  it('returns head sha and branch name', async () => {
    const dir = repoWithStagedChange()
    const result = succeed(
      await run(dir, (s) => Effect.all({ head: s.head, branch: s.branch }))
    )
    expect(result.head).toMatch(/^[0-9a-f]{40}$/)
    expect(result.branch).toBe('main')
  })

  it('reads the staged content of a file, not the disk content', async () => {
    const dir = repoWithStagedChange()
    writeFileSync(join(dir, 'a.txt'), 'unstaged edit\n')
    const content = succeed(await run(dir, (s) => s.stagedFile('a.txt')))
    expect(content).toBe('first line\nstaged line\n')
  })

  it('uses the sentinel head in an empty repo and still resolves the branch', async () => {
    const dir = initRepo()
    const result = succeed(
      await run(dir, (s) => Effect.all({ head: s.head, branch: s.branch }))
    )
    expect(result.head).toBe(emptyRepoSentinel)
    expect(result.branch).toBe('main')
  })

  it('fails with GitError outside a git repository', async () => {
    const dir = tempDir()
    const error = succeed(await run(dir, (s) => Effect.flip(s.head)))
    expect(error._tag).toBe('GitError')
  })

  it('fails with GitError when the staged file does not exist', async () => {
    const dir = repoWithStagedChange()
    const error = succeed(await run(dir, (s) => Effect.flip(s.stagedFile('missing.txt'))))
    expect(error._tag).toBe('GitError')
    expect(error.message).toContain('git show :0:missing.txt failed')
  })
})
