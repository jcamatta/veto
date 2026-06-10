import { Command, CommandExecutor } from '@effect/platform'
import { Effect, Layer, Stream } from 'effect'
import { gitError, type GitError } from '../domain/errors.js'
import { emptyRepoSentinel } from '../domain/run-key.js'
import type { StagedDiff } from '../domain/staged-diff.js'
import { Git, type GitService } from '../ports/git.js'

type Executor = CommandExecutor.CommandExecutor

type GitEnv = {
  readonly cwd: string | null
}

type GitOptions = {
  readonly cwd?: string
}

type GitOutput = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const describe = (args: readonly string[]): string => `git ${args.join(' ')}`

const collect = <E>(
  stream: Stream.Stream<Uint8Array, E>
): Effect.Effect<string, E> => stream.pipe(Stream.decodeText(), Stream.mkString)

const baseCommand =
  (env: GitEnv) =>
  (args: readonly string[]): Command.Command => {
    const command = Command.make('git', ...args)
    return env.cwd === null
      ? command
      : Command.workingDirectory(command, env.cwd)
  }

const runGit =
  (env: GitEnv) =>
  (args: readonly string[]): Effect.Effect<GitOutput, GitError, Executor> =>
    baseCommand(env)(args).pipe(
      Command.start,
      Effect.flatMap((process) =>
        Effect.all(
          {
            exitCode: process.exitCode,
            stdout: collect(process.stdout),
            stderr: collect(process.stderr)
          },
          { concurrency: 3 }
        )
      ),
      Effect.scoped,
      Effect.mapError((error) => gitError(`${describe(args)}: ${String(error)}`))
    )

const gitOutput =
  (env: GitEnv) =>
  (args: readonly string[]): Effect.Effect<string, GitError, Executor> =>
    runGit(env)(args).pipe(
      Effect.flatMap((output) =>
        output.exitCode === 0
          ? Effect.succeed(output.stdout)
          : Effect.fail(
              gitError(`${describe(args)} failed: ${output.stderr.trim()}`)
            )
      )
    )

const trimmed =
  (env: GitEnv) =>
  (args: readonly string[]): Effect.Effect<string, GitError, Executor> =>
    gitOutput(env)(args).pipe(Effect.map((text) => text.trim()))

const splitFiles = (text: string): readonly string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

const stagedDiff = (env: GitEnv): Effect.Effect<StagedDiff, GitError, Executor> =>
  Effect.all({
    diffText: gitOutput(env)(['diff', '--staged', '-U15']),
    files: gitOutput(env)(['diff', '--staged', '--name-only']).pipe(
      Effect.map(splitFiles)
    )
  })

const insideRepo = (env: GitEnv): Effect.Effect<boolean, never, Executor> =>
  runGit(env)(['rev-parse', '--git-dir']).pipe(
    Effect.map((output) => output.exitCode === 0),
    Effect.orElseSucceed(() => false)
  )

const head = (env: GitEnv): Effect.Effect<string, GitError, Executor> =>
  trimmed(env)(['rev-parse', 'HEAD']).pipe(
    Effect.catchAll((error) =>
      insideRepo(env).pipe(
        Effect.flatMap((inside) =>
          inside ? Effect.succeed(emptyRepoSentinel) : Effect.fail(error)
        )
      )
    )
  )

const branch = (env: GitEnv): Effect.Effect<string, GitError, Executor> =>
  trimmed(env)(['symbolic-ref', '--short', 'HEAD']).pipe(
    Effect.orElse(() => trimmed(env)(['rev-parse', '--abbrev-ref', 'HEAD']))
  )

const provide =
  (executor: CommandExecutor.CommandExecutor) =>
  <A, E>(effect: Effect.Effect<A, E, Executor>): Effect.Effect<A, E> =>
    Effect.provideService(effect, CommandExecutor.CommandExecutor, executor)

const makeService = (env: GitEnv): Effect.Effect<GitService, never, Executor> =>
  Effect.map(CommandExecutor.CommandExecutor, (executor) => ({
    stagedDiff: provide(executor)(stagedDiff(env)),
    head: provide(executor)(head(env)),
    branch: provide(executor)(branch(env)),
    stagedFile: (path) =>
      provide(executor)(gitOutput(env)(['show', `:0:${path}`]))
  }))

const commandGit = (options: GitOptions): Layer.Layer<Git, never, Executor> =>
  Layer.effect(Git, makeService({ cwd: options.cwd ?? null }))

const commandGitLive: Layer.Layer<Git, never, Executor> = commandGit({})

export { type GitOptions, commandGit, commandGitLive }
