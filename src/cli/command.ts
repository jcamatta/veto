import { Command } from '@effect/cli'
import type {
  CommandExecutor,
  FileSystem,
  Path,
  Terminal
} from '@effect/platform'
import { Effect } from 'effect'
import type { QueryFn } from '../adapters/sdk-agent.js'
import type { ConfigError, GitError } from '../domain/errors.js'
import { runReview } from '../engine/run-review.js'
import { runInit } from './init-command.js'
import { productionLayers } from './layers.js'
import { cliOptions, type CliArgs } from './options.js'
import { prepare } from './prepare.js'
import { resolveRepoRoot } from './repo-root.js'

type CliExitCode = 0 | 1 | 2

type CliDeps = {
  readonly exit: (code: CliExitCode) => Effect.Effect<never>
  readonly cwd?: string
  readonly queryFn?: QueryFn
}

type CliEnvironment =
  | CommandExecutor.CommandExecutor
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal

type Cli = (
  argv: readonly string[]
) => Effect.Effect<void, never, CliEnvironment>

const version = '0.1.0'

const handler =
  (deps: CliDeps) =>
  (args: CliArgs): Effect.Effect<void, ConfigError | GitError, CliEnvironment> =>
    resolveRepoRoot(deps.cwd ?? null).pipe(
      Effect.flatMap((repoRoot) => prepare({ args, repoRoot })),
      Effect.flatMap((input) =>
        runReview(input).pipe(
          Effect.provide(
            productionLayers({
              repoRoot: input.settings.repoRoot,
              runsDir: input.settings.runsDir,
              ...(deps.queryFn === undefined ? {} : { queryFn: deps.queryFn })
            })
          )
        )
      ),
      Effect.flatMap((code) => deps.exit(code))
    )

const misuse =
  (deps: CliDeps) =>
  (error: ConfigError | GitError): Effect.Effect<never> =>
    Effect.logError(error.message).pipe(Effect.zipRight(deps.exit(2)))

const initSubcommand = (deps: CliDeps) =>
  Command.make('init', {}, () =>
    runInit(deps.cwd ?? null).pipe(Effect.flatMap(() => deps.exit(0)))
  )

const makeCli = (deps: CliDeps): Cli => {
  const command = Command.make('veto', cliOptions, handler(deps)).pipe(
    Command.withSubcommands([initSubcommand(deps)])
  )
  const run = Command.run(command, { name: 'veto', version })
  return (argv) =>
    run(argv).pipe(
      Effect.catchAll((error) =>
        error._tag === 'ConfigError' || error._tag === 'GitError'
          ? misuse(deps)(error)
          : deps.exit(2)
      )
    )
}

export { type CliExitCode, type CliDeps, type Cli, makeCli }
