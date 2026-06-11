import { FileSystem, Path } from '@effect/platform'
import { Array as Arr, Effect, Order, Schema } from 'effect'
import { parse } from 'yaml'
import { isYamlFile } from '../core/yaml-file.js'
import { configError, type ConfigError } from '../domain/errors.js'
import { ReviewerConfig } from '../domain/reviewer-config.js'

type LoadedConfig = {
  readonly path: string
  readonly source: string
  readonly config: ReviewerConfig
}

type LoaderEnv = {
  readonly fs: FileSystem.FileSystem
  readonly path: Path.Path
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const listConfigs =
  (env: LoaderEnv) =>
  (target: string): Effect.Effect<readonly string[], ConfigError> =>
    env.fs.readDirectory(target).pipe(
      Effect.mapError(() =>
        configError(`cannot read config directory: ${target}`)
      ),
      Effect.map((names) =>
        Arr.sort(names.filter(isYamlFile), Order.string).map((name) =>
          env.path.join(target, name)
        )
      )
    )

const discover =
  (env: LoaderEnv) =>
  (target: string): Effect.Effect<readonly string[], ConfigError> =>
    env.fs.stat(target).pipe(
      Effect.mapError(() => configError(`config path not found: ${target}`)),
      Effect.flatMap((info) =>
        info.type === 'Directory'
          ? listConfigs(env)(target)
          : Effect.succeed([target])
      ),
      Effect.filterOrFail(
        (files) => files.length > 0,
        () => configError(`no reviewer configs found in: ${target}`)
      )
    )

const parseYaml = (input: {
  readonly file: string
  readonly source: string
}): Effect.Effect<unknown, ConfigError> =>
  Effect.try({
    try: () => parse(input.source) as unknown,
    catch: (error) =>
      configError(`invalid YAML in ${input.file}: ${describeError(error)}`)
  })

const decodeConfig = (input: {
  readonly file: string
  readonly data: unknown
}): Effect.Effect<ReviewerConfig, ConfigError> =>
  Schema.decodeUnknown(ReviewerConfig)(input.data).pipe(
    Effect.mapError((error) =>
      configError(`invalid config ${input.file}: ${error.message}`)
    )
  )

const loadOne =
  (env: LoaderEnv) =>
  (file: string): Effect.Effect<LoadedConfig, ConfigError> =>
    env.fs.readFileString(file).pipe(
      Effect.mapError(() => configError(`cannot read config file: ${file}`)),
      Effect.flatMap((source) =>
        parseYaml({ file, source }).pipe(
          Effect.flatMap((data) => decodeConfig({ file, data })),
          Effect.map((config) => ({ path: file, source, config }))
        )
      )
    )

const discoverConfigs = (
  target: string
): Effect.Effect<
  readonly string[],
  ConfigError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.all({ fs: FileSystem.FileSystem, path: Path.Path }).pipe(
    Effect.flatMap((env) => discover(env)(target))
  )

const loadConfigs = (
  target: string
): Effect.Effect<
  readonly LoadedConfig[],
  ConfigError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.all({ fs: FileSystem.FileSystem, path: Path.Path }).pipe(
    Effect.flatMap((env) =>
      discover(env)(target).pipe(
        Effect.flatMap((files) => Effect.forEach(files, loadOne(env)))
      )
    )
  )

export { type LoadedConfig, discoverConfigs, loadConfigs }
