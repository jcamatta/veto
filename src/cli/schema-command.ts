import { Terminal } from '@effect/platform'
import { Effect } from 'effect'
import { configJsonSchemaText } from '../core/config-json-schema.js'

const printSchema: Effect.Effect<void, never, Terminal.Terminal> =
  Terminal.Terminal.pipe(
    Effect.flatMap((terminal) =>
      terminal.display(`${configJsonSchemaText}\n`)
    ),
    Effect.orDie
  )

export { printSchema }
