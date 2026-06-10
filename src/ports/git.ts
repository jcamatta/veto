import { Context, Effect } from 'effect'
import type { GitError } from '../domain/errors.js'
import type { StagedDiff } from '../domain/staged-diff.js'

type GitService = {
  readonly stagedDiff: Effect.Effect<StagedDiff, GitError>
  readonly head: Effect.Effect<string, GitError>
  readonly branch: Effect.Effect<string, GitError>
  readonly stagedFile: (path: string) => Effect.Effect<string, GitError>
}

class Git extends Context.Tag('veto/Git')<Git, GitService>() {}

export { type GitService, Git }
