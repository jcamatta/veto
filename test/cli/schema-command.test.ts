import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Layer, Ref } from 'effect'
import { Terminal } from '@effect/platform'
import { NodeContext } from '@effect/platform-node'
import { makeCli, type CliExitCode } from '../../src/cli/command.js'
import { configJsonSchema } from '../../src/core/config-json-schema.js'
import { schemaText } from '../../src/cli/schema-command.js'

type FakeTerminal = {
  readonly outputs: Effect.Effect<readonly string[]>
  readonly layer: Layer.Layer<Terminal.Terminal>
}

const makeFakeTerminal = (): FakeTerminal => {
  const ref = Effect.runSync(Ref.make<readonly string[]>([]))
  const terminal: Terminal.Terminal = {
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    isTTY: Effect.succeed(false),
    readInput: Effect.die('readInput not supported in tests'),
    readLine: Effect.die('readLine not supported in tests'),
    display: (text) => Ref.update(ref, (all) => [...all, text])
  }
  return {
    outputs: Ref.get(ref),
    layer: Layer.succeed(Terminal.Terminal, terminal)
  }
}

const runSchema = async (): Promise<{
  readonly codes: readonly CliExitCode[]
  readonly stdout: string
}> => {
  const codes = await Effect.runPromise(Ref.make<readonly CliExitCode[]>([]))
  const fake = makeFakeTerminal()
  const cli = makeCli({
    exit: (code) =>
      Ref.update(codes, (recorded) => [...recorded, code]).pipe(
        Effect.zipRight(Effect.interrupt)
      ),
    cwd: mkdtempSync(join(tmpdir(), 'veto-schema-'))
  })
  await Effect.runPromiseExit(
    cli(['node', 'veto', 'schema']).pipe(
      Effect.provide(Layer.merge(NodeContext.layer, fake.layer))
    )
  )
  const outputs = await Effect.runPromise(fake.outputs)
  return {
    codes: await Effect.runPromise(Ref.get(codes)),
    stdout: outputs.join('')
  }
}

describe('veto schema', () => {
  it('renders the reviewer config schema as stable JSON text', () => {
    expect(JSON.parse(schemaText)).toEqual(configJsonSchema)
  })

  it('prints the JSON schema and exits 0', async () => {
    const result = await runSchema()
    expect(result.codes).toEqual([0])
    expect(JSON.parse(result.stdout)).toEqual(configJsonSchema)
  })
})
