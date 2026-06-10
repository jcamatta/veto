import { describe, expect, it } from 'vitest'
import { DateTime, Effect } from 'effect'
import type { Baseline } from '../../src/domain/baseline.js'
import { ReplayServed, RunCompleted } from '../../src/domain/review-event.js'
import type { RunKey } from '../../src/domain/run-key.js'
import type { RunRecord } from '../../src/domain/run-record.js'
import { RunStore, type RunStoreService } from '../../src/ports/run-store.js'
import { makeInMemoryRunStore } from './in-memory-run-store.js'

const key: RunKey = { head: 'aaa111', branch: 'main', reviewer: 'architect' }

const otherKey: RunKey = { head: 'bbb222', branch: 'main', reviewer: 'architect' }

const baseline: Baseline = { attempt: 1, findings: [] }

const record: RunRecord = {
  diffHash: 'dh',
  configHash: 'ch',
  attempt: 1,
  sessionId: null,
  ranAt: DateTime.unsafeMake('2026-06-09T14:03:22Z'),
  durationMs: 1200
}

const withStore = <A>(
  use: (store: RunStoreService) => Effect.Effect<A>
): Promise<A> => {
  const { layer } = makeInMemoryRunStore()
  return Effect.runPromise(
    Effect.flatMap(RunStore, use).pipe(Effect.provide(layer))
  )
}

describe('makeInMemoryRunStore', () => {
  it('appends events per key and attempt', async () => {
    const store = makeInMemoryRunStore()
    const replay = ReplayServed.make({ reviewer: 'architect' })
    const completed = RunCompleted.make({ blocking: false })
    await Effect.runPromise(
      Effect.flatMap(RunStore, (s) =>
        Effect.all([
          s.appendEvent({ key, attempt: 1, event: replay }),
          s.appendEvent({ key, attempt: 1, event: completed }),
          s.appendEvent({ key, attempt: 2, event: replay })
        ])
      ).pipe(Effect.provide(store.layer))
    )
    const memory = await Effect.runPromise(store.memory)
    expect(memory.events.get('aaa111/architect/attempt-1')).toEqual([
      replay,
      completed
    ])
    expect(memory.events.get('aaa111/architect/attempt-2')).toEqual([replay])
  })

  it('round-trips baseline and record, null when missing', async () => {
    const result = await withStore((s) =>
      Effect.gen(function* () {
        const missingBaseline = yield* s.readBaseline(key)
        const missingRecord = yield* s.readRecord(key)
        yield* s.writeBaseline({ key, baseline })
        yield* s.writeRecord({ key, record })
        const storedBaseline = yield* s.readBaseline(key)
        const storedRecord = yield* s.readRecord(key)
        return { missingBaseline, missingRecord, storedBaseline, storedRecord }
      })
    )
    expect(result.missingBaseline).toBeNull()
    expect(result.missingRecord).toBeNull()
    expect(result.storedBaseline).toEqual(baseline)
    expect(result.storedRecord).toEqual(record)
  })

  it('keeps keys isolated per head and reviewer', async () => {
    const result = await withStore((s) =>
      Effect.gen(function* () {
        yield* s.writeBaseline({ key, baseline })
        return yield* s.readBaseline(otherKey)
      })
    )
    expect(result).toBeNull()
  })

  it('collects written projections in order', async () => {
    const store = makeInMemoryRunStore()
    const projection = {
      ranAt: DateTime.unsafeMake('2026-06-09T14:03:22Z'),
      head: 'aaa111',
      branch: 'main',
      attempt: 1,
      reviewers: [],
      blocking: false
    }
    await Effect.runPromise(
      Effect.flatMap(RunStore, (s) =>
        s.writeProjections({ projection, markdown: '# review\n' })
      ).pipe(Effect.provide(store.layer))
    )
    const memory = await Effect.runPromise(store.memory)
    expect(memory.projections).toEqual([{ projection, markdown: '# review\n' }])
  })

  it('prunes everything but the last N heads', async () => {
    const store = makeInMemoryRunStore()
    const heads = ['h1', 'h2', 'h3']
    await Effect.runPromise(
      Effect.flatMap(RunStore, (s) =>
        Effect.all([
          ...heads.map((head) =>
            s.writeBaseline({ key: { ...key, head }, baseline })
          ),
          s.appendEvent({
            key: { ...key, head: 'h1' },
            attempt: 1,
            event: RunCompleted.make({ blocking: false })
          }),
          s.prune(2)
        ])
      ).pipe(Effect.provide(store.layer))
    )
    const memory = await Effect.runPromise(store.memory)
    expect([...memory.baselines.keys()]).toEqual([
      'h2/architect',
      'h3/architect'
    ])
    expect(memory.events.size).toBe(0)
  })
})
