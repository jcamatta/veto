import type { CommandExecutor, FileSystem, Path, Terminal } from '@effect/platform'
import { Layer } from 'effect'
import { commandGit } from '../adapters/command-git.js'
import { fsRunStore } from '../adapters/fs-run-store.js'
import { sdkAgent, type QueryFn } from '../adapters/sdk-agent.js'
import { systemClockLive } from '../adapters/system-clock.js'
import { terminalReporterLive } from '../adapters/terminal-reporter.js'
import type { Agent } from '../ports/agent.js'
import type { ReviewClock } from '../ports/clock.js'
import type { Git } from '../ports/git.js'
import type { Reporter } from '../ports/reporter.js'
import type { RunStore } from '../ports/run-store.js'

type ProductionOptions = {
  readonly repoRoot: string
  readonly runsDir: string
  readonly queryFn?: QueryFn
}

type ReviewPorts = Git | Agent | RunStore | Reporter | ReviewClock

type PlatformNeeds =
  | CommandExecutor.CommandExecutor
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal

const productionLayers = (
  options: ProductionOptions
): Layer.Layer<ReviewPorts, never, PlatformNeeds> =>
  Layer.mergeAll(
    commandGit({ cwd: options.repoRoot }),
    sdkAgent({
      repoRoot: options.repoRoot,
      ...(options.queryFn === undefined ? {} : { queryFn: options.queryFn })
    }),
    fsRunStore(options.runsDir),
    terminalReporterLive,
    systemClockLive
  )

export { type ProductionOptions, type ReviewPorts, productionLayers }
