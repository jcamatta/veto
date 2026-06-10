import { Terminal } from '@effect/platform'
import { Effect, Layer, Schema } from 'effect'
import { renderPretty } from '../core/pretty.js'
import { LatestProjection } from '../domain/latest-projection.js'
import { Reporter, type EmitInput } from '../ports/reporter.js'

const renderJson = (projection: LatestProjection): Effect.Effect<string> =>
  Schema.encode(LatestProjection)(projection).pipe(
    Effect.map((encoded) => JSON.stringify(encoded, null, 2)),
    Effect.orDie
  )

const renderReport = (input: EmitInput): Effect.Effect<string> =>
  input.format === 'json'
    ? renderJson(input.projection)
    : Effect.succeed(renderPretty(input.projection))

const terminalReporterLive: Layer.Layer<
  Reporter,
  never,
  Terminal.Terminal
> = Layer.effect(
  Reporter,
  Effect.map(Terminal.Terminal, (terminal) => ({
    emit: (input) =>
      renderReport(input).pipe(
        Effect.flatMap((text) => terminal.display(`${text}\n`)),
        Effect.orDie
      )
  }))
)

export { terminalReporterLive }
