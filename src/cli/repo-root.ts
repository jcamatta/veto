import { Command, CommandExecutor } from '@effect/platform'
import { Effect, Stream } from 'effect'
import { gitError, type GitError } from '../domain/errors.js'

type Executor = CommandExecutor.CommandExecutor

type GitOutput = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const collect = <E>(
  stream: Stream.Stream<Uint8Array, E>
): Effect.Effect<string, E> => stream.pipe(Stream.decodeText(), Stream.mkString)

const toplevel = (cwd: string | null): Command.Command => {
  const command = Command.make('git', 'rev-parse', '--show-toplevel')
  return cwd === null ? command : Command.workingDirectory(command, cwd)
}

const output = (cwd: string | null): Effect.Effect<GitOutput, GitError, Executor> =>
  toplevel(cwd).pipe(
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
    Effect.mapError((error) =>
      gitError(`git rev-parse --show-toplevel: ${String(error)}`)
    )
  )

const resolveRepoRoot = (
  cwd: string | null
): Effect.Effect<string, GitError, Executor> =>
  output(cwd).pipe(
    Effect.flatMap((result) =>
      result.exitCode === 0
        ? Effect.succeed(result.stdout.trim())
        : Effect.fail(gitError(`not a git repository: ${result.stderr.trim()}`))
    )
  )

export { resolveRepoRoot }
