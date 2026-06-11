import { Args, Options } from '@effect/cli'
import { FileSystem, Path, Terminal } from '@effect/platform'
import { Effect } from 'effect'
import { discoverConfigs, loadConfigs } from '../adapters/config-loader.js'
import { configError, type ConfigError } from '../domain/errors.js'

type CheckExitCode = 0 | 2

type CheckArgs = {
  readonly targets: readonly string[]
  readonly config: readonly string[]
}

type CheckInput = {
  readonly args: CheckArgs
  readonly repoRoot: string
}

type CheckEnvironment =
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal

const targetsArg = Args.text({ name: 'target' }).pipe(
  Args.withDescription(
    'a reviewer config file or a directory of reviewer YAML configs'
  ),
  Args.repeated
)

const configOption = Options.text('config').pipe(
  Options.withDescription('path to a reviewer config file (repeatable)'),
  Options.repeated
)

const checkArgs = { targets: targetsArg, config: configOption }

const display =
  (terminal: Terminal.Terminal) =>
  (line: string): Effect.Effect<void> =>
    terminal.display(`${line}\n`).pipe(Effect.orDie)

const defaultFiles = (
  repoRoot: string
): Effect.Effect<readonly string[], ConfigError, CheckEnvironment> =>
  Path.Path.pipe(
    Effect.flatMap((path) => discoverConfigs(path.join(repoRoot, '.veto'))),
    Effect.mapError((error) =>
      error.message.startsWith('config path not found')
        ? configError(
            'no reviewer configs found: no .veto/ in the repo root — run veto init, pass a config directory, or use --config'
          )
        : error
    )
  )

const filesOf = (
  input: CheckInput
): Effect.Effect<readonly string[], ConfigError, CheckEnvironment> => {
  const targets = [...input.args.targets, ...input.args.config]
  return targets.length === 0
    ? defaultFiles(input.repoRoot)
    : Effect.forEach(targets, discoverConfigs).pipe(
        Effect.map((lists) => lists.flat())
      )
}

const checkFile =
  (terminal: Terminal.Terminal) =>
  (
    file: string
  ): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> =>
    loadConfigs(file).pipe(
      Effect.flatMap(() =>
        display(terminal)(`ok ${file}`).pipe(Effect.as(true))
      ),
      Effect.catchAll((error) =>
        display(terminal)(`error ${error.message}`).pipe(Effect.as(false))
      )
    )

const runCheck = (
  input: CheckInput
): Effect.Effect<CheckExitCode, ConfigError, CheckEnvironment> =>
  Effect.all({ terminal: Terminal.Terminal, files: filesOf(input) }).pipe(
    Effect.flatMap(({ terminal, files }) =>
      Effect.forEach(files, checkFile(terminal))
    ),
    Effect.map((oks): CheckExitCode => (oks.every(Boolean) ? 0 : 2))
  )

export { type CheckArgs, type CheckInput, checkArgs, runCheck }
