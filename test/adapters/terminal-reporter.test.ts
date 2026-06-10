import { describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Ref } from 'effect'
import { Terminal } from '@effect/platform'
import { terminalReporterLive } from '../../src/adapters/terminal-reporter.js'
import type { LatestProjection } from '../../src/domain/latest-projection.js'
import { Reporter, type ReportFormat } from '../../src/ports/reporter.js'

const projection: LatestProjection = {
  ranAt: DateTime.unsafeMake('2026-06-09T14:03:22Z'),
  head: 'a1b2c3',
  branch: 'main',
  attempt: 1,
  reviewers: [
    { name: 'architect', status: 'completed', findings: [], resolved: [] }
  ],
  blocking: false
}

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

const emit = async (format: ReportFormat): Promise<readonly string[]> => {
  const fake = makeFakeTerminal()
  return Effect.runPromise(
    Effect.flatMap(Reporter, (reporter) =>
      reporter.emit({ projection, format })
    ).pipe(
      Effect.provide(terminalReporterLive),
      Effect.provide(fake.layer),
      Effect.andThen(fake.outputs)
    )
  )
}

describe('terminalReporterLive', () => {
  it('emits the pretty report to the terminal', async () => {
    const outputs = await emit('pretty')
    expect(outputs).toHaveLength(1)
    expect(outputs[0]).toContain('veto — 2026-06-09T14:03:22.000Z')
    expect(outputs[0]).toContain('architect: completed, no findings')
    expect(outputs[0]).toContain('Full report: .veto/runs/latest.md')
  })

  it('emits the encoded projection as JSON', async () => {
    const outputs = await emit('json')
    expect(outputs).toHaveLength(1)
    const parsed: unknown = JSON.parse(outputs[0] ?? '')
    expect(parsed).toMatchObject({
      ranAt: '2026-06-09T14:03:22.000Z',
      head: 'a1b2c3',
      branch: 'main',
      attempt: 1,
      blocking: false
    })
  })
})
