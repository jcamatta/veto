import {
  FileSystem,
  Path,
  Terminal,
  type CommandExecutor
} from '@effect/platform'
import { Effect } from 'effect'
import { detectStack, type Stack } from '../core/init-detect.js'
import { appendHookLine, hookLine } from '../core/init-hook.js'
import { agentSnippet, renderStarterConfig } from '../core/init-template.js'
import { isYamlFile } from '../core/yaml-file.js'
import {
  configError,
  type ConfigError,
  type GitError
} from '../domain/errors.js'
import { resolveRepoRoot } from './repo-root.js'
import { schemaText } from './schema-command.js'

type InitEnv = {
  readonly fs: FileSystem.FileSystem
  readonly path: Path.Path
  readonly terminal: Terminal.Terminal
}

type InitEnvironment =
  | CommandExecutor.CommandExecutor
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal

const display =
  (env: InitEnv) =>
  (line: string): Effect.Effect<void> =>
    env.terminal.display(`${line}\n`).pipe(Effect.orDie)

const refuseExistingConfigs =
  (env: InitEnv) =>
  (vetoDir: string): Effect.Effect<void, ConfigError> =>
    env.fs.readDirectory(vetoDir).pipe(
      Effect.orElseSucceed((): readonly string[] => []),
      Effect.flatMap((entries) =>
        entries.some(isYamlFile)
          ? Effect.fail(
              configError(
                `${vetoDir} already has reviewer configs — veto init refuses to clobber them`
              )
            )
          : Effect.void
      )
    )

const detectedStack =
  (env: InitEnv) =>
  (repoRoot: string): Effect.Effect<Stack> =>
    env.fs.readFileString(env.path.join(repoRoot, 'package.json')).pipe(
      Effect.map(detectStack),
      Effect.orElseSucceed(() => detectStack(null))
    )

const writeStarter =
  (env: InitEnv) =>
  (input: {
    readonly vetoDir: string
    readonly stack: Stack
  }): Effect.Effect<void> => {
    const file = env.path.join(input.vetoDir, 'architect.yaml')
    const schemaFile = env.path.join(input.vetoDir, 'schema.json')
    return env.fs
      .makeDirectory(input.vetoDir, { recursive: true })
      .pipe(
        Effect.zipRight(
          env.fs.writeFileString(file, renderStarterConfig(input.stack))
        ),
        Effect.zipRight(env.fs.writeFileString(schemaFile, `${schemaText}\n`)),
        Effect.orDie,
        Effect.zipRight(display(env)(`created ${file} (${input.stack} starter)`)),
        Effect.zipRight(display(env)(`created ${schemaFile} (editor validation)`))
      )
  }

const wireHook =
  (env: InitEnv) =>
  (repoRoot: string): Effect.Effect<void> => {
    const hook = env.path.join(repoRoot, '.husky', 'pre-commit')
    return env.fs.readFileString(hook).pipe(
      Effect.flatMap((existing) => {
        const appended = appendHookLine(existing)
        return appended.changed
          ? env.fs
              .writeFileString(hook, appended.text)
              .pipe(
                Effect.orDie,
                Effect.zipRight(display(env)(`wired ${hook} with: ${hookLine}`))
              )
          : display(env)(`${hook} already runs veto — left untouched`)
      }),
      Effect.orElse(() =>
        display(env)(
          `no .husky/pre-commit found — add this line to your pre-commit hook: ${hookLine}`
        )
      )
    )
  }

const scaffold =
  (env: InitEnv) =>
  (repoRoot: string): Effect.Effect<void, ConfigError> => {
    const vetoDir = env.path.join(repoRoot, '.veto')
    return refuseExistingConfigs(env)(vetoDir).pipe(
      Effect.zipRight(detectedStack(env)(repoRoot)),
      Effect.flatMap((stack) => writeStarter(env)({ vetoDir, stack })),
      Effect.zipRight(wireHook(env)(repoRoot)),
      Effect.zipRight(
        display(env)(`add to CLAUDE.md / AGENTS.md: ${agentSnippet}`)
      )
    )
  }

const runInit = (
  cwd: string | null
): Effect.Effect<void, ConfigError | GitError, InitEnvironment> =>
  Effect.all({
    fs: FileSystem.FileSystem,
    path: Path.Path,
    terminal: Terminal.Terminal
  }).pipe(
    Effect.flatMap((env) =>
      resolveRepoRoot(cwd).pipe(Effect.flatMap(scaffold(env)))
    )
  )

export { runInit }
