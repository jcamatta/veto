import {
  FileSystem,
  Path,
  Terminal,
  type CommandExecutor
} from '@effect/platform'
import { Effect, Option, Schema } from 'effect'
import { fsRunStore } from '../adapters/fs-run-store.js'
import { renderRuleStats } from '../core/rule-stats-format.js'
import { foldRuleStats } from '../core/rule-stats.js'
import { type ConfigError, type GitError } from '../domain/errors.js'
import { RuleStatsReport, type RuleStats } from '../domain/rule-stats.js'
import type { ReportFormat } from '../ports/reporter.js'
import { retainedHeads, RunStore } from '../ports/run-store.js'
import { baseDirOf, defaultVetoDir } from './config-path.js'
import { cliOptions, type CliArgs } from './options.js'
import { resolveRepoRoot } from './repo-root.js'

type StatsArgs = Pick<CliArgs, 'dir' | 'config' | 'format'>

type StatsEnv = {
  readonly fs: FileSystem.FileSystem
  readonly path: Path.Path
  readonly terminal: Terminal.Terminal
}

type StatsEnvironment =
  | CommandExecutor.CommandExecutor
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal

const statsOptions = {
  dir: cliOptions.dir,
  config: cliOptions.config,
  format: cliOptions.format
}

const runsDirOf =
  (env: StatsEnv) =>
  (input: {
    readonly args: StatsArgs
    readonly repoRoot: string
  }): Effect.Effect<string, ConfigError> => {
    const target = Option.getOrUndefined(input.args.dir) ?? input.args.config[0]
    const base =
      target === undefined
        ? defaultVetoDir(env)(input.repoRoot)
        : baseDirOf(env)(target)
    return base.pipe(Effect.map((dir) => env.path.join(dir, 'runs')))
  }

const ruleStats: Effect.Effect<readonly RuleStats[], never, RunStore> =
  Effect.flatMap(RunStore, (store) => store.readAllEvents).pipe(
    Effect.map(foldRuleStats)
  )

const renderReport = (input: {
  readonly format: ReportFormat
  readonly rules: readonly RuleStats[]
}): Effect.Effect<string> =>
  input.format === 'json'
    ? Schema.encode(RuleStatsReport)({ retainedHeads, rules: input.rules }).pipe(
        Effect.map((encoded) => `${JSON.stringify(encoded, null, 2)}\n`),
        Effect.orDie
      )
    : Effect.succeed(renderRuleStats({ rules: input.rules, retainedHeads }))

const statsText =
  (env: StatsEnv) =>
  (input: {
    readonly cwd: string | null
    readonly args: StatsArgs
  }): Effect.Effect<string, ConfigError | GitError, StatsEnvironment> =>
    resolveRepoRoot(input.cwd).pipe(
      Effect.flatMap((repoRoot) =>
        runsDirOf(env)({ args: input.args, repoRoot })
      ),
      Effect.flatMap((runsDir) =>
        ruleStats.pipe(Effect.provide(fsRunStore(runsDir)))
      ),
      Effect.flatMap((rules) =>
        renderReport({ format: input.args.format, rules })
      )
    )

const runStats = (input: {
  readonly cwd: string | null
  readonly args: StatsArgs
}): Effect.Effect<void, ConfigError | GitError, StatsEnvironment> =>
  Effect.all({
    fs: FileSystem.FileSystem,
    path: Path.Path,
    terminal: Terminal.Terminal
  }).pipe(
    Effect.flatMap((env) =>
      statsText(env)(input).pipe(
        Effect.flatMap((text) => env.terminal.display(text).pipe(Effect.orDie))
      )
    )
  )

export { type StatsArgs, statsOptions, runStats }
