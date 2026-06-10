import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { Git } from '../../src/ports/git.js'
import { failingGit, fixtureGit, type FixtureRepo } from './fixture-git.js'

const repo: FixtureRepo = {
  diff: {
    diffText: 'diff --git a/src/a.ts b/src/a.ts\n+const a = 1\n',
    files: ['src/a.ts']
  },
  head: 'a1b2c3d4',
  branch: 'main',
  stagedContents: { 'src/a.ts': 'const a = 1\n' }
}

const run = <A, E>(effect: Effect.Effect<A, E, Git>) =>
  Effect.runPromise(Effect.either(effect.pipe(Effect.provide(fixtureGit(repo)))))

describe('fixtureGit', () => {
  it('serves the fixture diff, head, and branch', async () => {
    const result = await run(
      Effect.gen(function* () {
        const git = yield* Git
        const diff = yield* git.stagedDiff
        const head = yield* git.head
        const branch = yield* git.branch
        return { diff, head, branch }
      })
    )
    expect(result).toMatchObject({
      _tag: 'Right',
      right: { diff: repo.diff, head: 'a1b2c3d4', branch: 'main' }
    })
  })

  it('serves staged file content from the fixture map', async () => {
    const result = await run(
      Effect.flatMap(Git, (git) => git.stagedFile('src/a.ts'))
    )
    expect(result).toMatchObject({ _tag: 'Right', right: 'const a = 1\n' })
  })

  it('fails with GitError for unknown staged files', async () => {
    const result = await run(
      Effect.flatMap(Git, (git) => git.stagedFile('missing.ts'))
    )
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('GitError')
      expect(result.left.message).toContain('missing.ts')
    }
  })
})

describe('failingGit', () => {
  it('fails every method with GitError', async () => {
    const program = Effect.gen(function* () {
      const git = yield* Git
      const all = [
        Effect.either(git.stagedDiff),
        Effect.either(git.head),
        Effect.either(git.branch),
        Effect.either(git.stagedFile('src/a.ts'))
      ]
      return yield* Effect.all(all)
    })
    const results = await Effect.runPromise(
      program.pipe(Effect.provide(failingGit('not a git repo')))
    )
    results.forEach((result) => {
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toEqual({
          _tag: 'GitError',
          message: 'not a git repo'
        })
      }
    })
  })
})
