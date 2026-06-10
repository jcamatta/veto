import { Effect, Layer } from 'effect'
import { gitError } from '../../src/domain/errors.js'
import type { StagedDiff } from '../../src/domain/staged-diff.js'
import { Git, type GitService } from '../../src/ports/git.js'

type FixtureRepo = {
  readonly diff: StagedDiff
  readonly head: string
  readonly branch: string
  readonly stagedContents: Readonly<Record<string, string>>
}

const fixtureGitService = (repo: FixtureRepo): GitService => ({
  stagedDiff: Effect.succeed(repo.diff),
  head: Effect.succeed(repo.head),
  branch: Effect.succeed(repo.branch),
  stagedFile: (path) => {
    const content = repo.stagedContents[path]
    return content === undefined
      ? Effect.fail(gitError(`no staged content for "${path}"`))
      : Effect.succeed(content)
  }
})

const fixtureGit = (repo: FixtureRepo): Layer.Layer<Git> =>
  Layer.succeed(Git, fixtureGitService(repo))

const failingGit = (message: string): Layer.Layer<Git> =>
  Layer.succeed(Git, {
    stagedDiff: Effect.fail(gitError(message)),
    head: Effect.fail(gitError(message)),
    branch: Effect.fail(gitError(message)),
    stagedFile: () => Effect.fail(gitError(message))
  })

export { type FixtureRepo, fixtureGitService, fixtureGit, failingGit }
