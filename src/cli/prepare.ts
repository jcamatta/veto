import { FileSystem, Path } from '@effect/platform'
import { Effect, Option } from 'effect'
import { loadConfigs, type LoadedConfig } from '../adapters/config-loader.js'
import { sha1 } from '../adapters/sha1.js'
import { isOk } from '../core/result.js'
import { parseSuppressions } from '../core/suppression.js'
import { configError, type ConfigError } from '../domain/errors.js'
import type { SuppressionList } from '../domain/suppression-list.js'
import { defaultTimeoutMs, type RunReviewInput } from '../engine/inputs.js'
import type { CliArgs } from './options.js'

type PrepareInput = {
  readonly args: CliArgs
  readonly repoRoot: string
}

type PrepareEnv = {
  readonly fs: FileSystem.FileSystem
  readonly path: Path.Path
}

type ResolvedTargets = {
  readonly targets: readonly string[]
  readonly first: string
}

const targetsOf = (
  args: CliArgs
): Effect.Effect<ResolvedTargets, ConfigError> => {
  const targets = [...Option.toArray(args.dir), ...args.config]
  const [first] = targets
  return first === undefined
    ? Effect.fail(
        configError(
          'no reviewer configs given: pass a config directory or --config'
        )
      )
    : Effect.succeed({ targets, first })
}

const baseDirOf =
  (env: PrepareEnv) =>
  (target: string): Effect.Effect<string> =>
    env.fs.stat(target).pipe(
      Effect.map((info) =>
        info.type === 'Directory' ? target : env.path.dirname(target)
      ),
      Effect.orElseSucceed(() => env.path.dirname(target))
    )

const readSuppressions =
  (env: PrepareEnv) =>
  (file: string): Effect.Effect<SuppressionList, ConfigError> =>
    env.fs.readFileString(file).pipe(
      Effect.orElseSucceed(() => ''),
      Effect.flatMap((text) => {
        const parsed = parseSuppressions(text)
        return isOk(parsed)
          ? Effect.succeed(parsed.value)
          : Effect.fail(parsed.error)
      })
    )

const assembleInput = (input: {
  readonly prepare: PrepareInput
  readonly loaded: readonly LoadedConfig[]
  readonly suppressions: SuppressionList
  readonly runsDir: string
}): RunReviewInput => ({
  reviewers: input.loaded.map((l) => ({ config: l.config, source: l.source })),
  settings: {
    hash: sha1,
    repoRoot: input.prepare.repoRoot,
    runsDir: input.runsDir,
    suppressions: input.suppressions,
    noCache: input.prepare.args.noCache,
    strictScope: false,
    timeoutMs: Option.match(input.prepare.args.timeout, {
      onNone: () => defaultTimeoutMs,
      onSome: (seconds) => seconds * 1000
    })
  },
  format: input.prepare.args.format
})

const assemble =
  (env: PrepareEnv) =>
  (input: {
    readonly prepare: PrepareInput
    readonly resolved: ResolvedTargets
  }): Effect.Effect<
    RunReviewInput,
    ConfigError,
    FileSystem.FileSystem | Path.Path
  > =>
    Effect.all({
      loaded: Effect.forEach(input.resolved.targets, loadConfigs).pipe(
        Effect.map((lists) => lists.flat())
      ),
      base: baseDirOf(env)(input.resolved.first)
    }).pipe(
      Effect.flatMap(({ loaded, base }) =>
        readSuppressions(env)(env.path.join(base, 'ignore')).pipe(
          Effect.map((suppressions) =>
            assembleInput({
              prepare: input.prepare,
              loaded,
              suppressions,
              runsDir: env.path.join(base, 'runs')
            })
          )
        )
      )
    )

const prepare = (
  input: PrepareInput
): Effect.Effect<
  RunReviewInput,
  ConfigError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.all({
    env: Effect.all({ fs: FileSystem.FileSystem, path: Path.Path }),
    resolved: targetsOf(input.args)
  }).pipe(
    Effect.flatMap(({ env, resolved }) =>
      assemble(env)({ prepare: input, resolved })
    )
  )

export { type PrepareInput, prepare }
