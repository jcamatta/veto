import type { FileSystem, Path } from '@effect/platform'
import { Effect, Option } from 'effect'
import { configError, type ConfigError } from '../domain/errors.js'

type ConfigPathEnv = {
  readonly fs: FileSystem.FileSystem
  readonly path: Path.Path
}

const defaultVetoDir =
  (env: ConfigPathEnv) =>
  (repoRoot: string): Effect.Effect<string, ConfigError> => {
    const candidate = env.path.join(repoRoot, '.veto')
    return env.fs.stat(candidate).pipe(
      Effect.option,
      Effect.flatMap((info) =>
        Option.isSome(info) && info.value.type === 'Directory'
          ? Effect.succeed(candidate)
          : Effect.fail(
              configError(
                'no reviewer configs found: no .veto/ in the repo root — run veto init, pass a config directory, or use --config'
              )
            )
      )
    )
  }

const baseDirOf =
  (env: ConfigPathEnv) =>
  (target: string): Effect.Effect<string> =>
    env.fs.stat(target).pipe(
      Effect.map((info) =>
        info.type === 'Directory' ? target : env.path.dirname(target)
      ),
      Effect.orElseSucceed(() => env.path.dirname(target))
    )

export { type ConfigPathEnv, defaultVetoDir, baseDirOf }
