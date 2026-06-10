import { NodeContext, NodeRuntime } from '@effect/platform-node'
import { Effect } from 'effect'
import { makeCli, type CliExitCode } from './cli/command.js'

const exitProcess = (code: CliExitCode): Effect.Effect<never> =>
  Effect.sync(() => process.exit(code))

const main = makeCli({ exit: exitProcess })(process.argv).pipe(
  Effect.provide(NodeContext.layer)
)

NodeRuntime.runMain(main)

export { main }
