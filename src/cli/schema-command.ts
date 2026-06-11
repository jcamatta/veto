import { Terminal } from '@effect/platform'
import { Effect } from 'effect'
import { configJsonSchema } from '../core/config-json-schema.js'

const schemaText = JSON.stringify(configJsonSchema, null, 2)

const printSchema: Effect.Effect<void, never, Terminal.Terminal> =
  Terminal.Terminal.pipe(
    Effect.flatMap((terminal) => terminal.display(`${schemaText}\n`)),
    Effect.orDie
  )

export { schemaText, printSchema }
