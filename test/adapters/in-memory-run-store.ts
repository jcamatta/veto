import { Effect, Layer, Ref } from 'effect'
import type { Baseline } from '../../src/domain/baseline.js'
import type { ReviewEvent } from '../../src/domain/review-event.js'
import type { RunKey } from '../../src/domain/run-key.js'
import type { RunRecord } from '../../src/domain/run-record.js'
import {
  RunStore,
  type RunStoreService,
  type WriteProjectionsInput
} from '../../src/ports/run-store.js'

type RunStoreMemory = {
  readonly events: ReadonlyMap<string, readonly ReviewEvent[]>
  readonly baselines: ReadonlyMap<string, Baseline>
  readonly records: ReadonlyMap<string, RunRecord>
  readonly projections: readonly WriteProjectionsInput[]
}

type InMemoryRunStore = {
  readonly layer: Layer.Layer<RunStore>
  readonly memory: Effect.Effect<RunStoreMemory>
}

const emptyMemory: RunStoreMemory = {
  events: new Map(),
  baselines: new Map(),
  records: new Map(),
  projections: []
}

const keyPath = (key: RunKey): string => `${key.head}/${key.reviewer}`

const headOf = (mapKey: string): string => mapKey.split('/')[0] ?? ''

const setEntry = <V>(
  map: ReadonlyMap<string, V>,
  entry: readonly [string, V]
): ReadonlyMap<string, V> => new Map([...map.entries(), entry])

const dropHeads = <V>(
  map: ReadonlyMap<string, V>,
  dropped: ReadonlySet<string>
): ReadonlyMap<string, V> =>
  new Map([...map.entries()].filter(([k]) => !dropped.has(headOf(k))))

const orderedHeads = (memory: RunStoreMemory): readonly string[] => {
  const all = [
    ...memory.records.keys(),
    ...memory.baselines.keys(),
    ...memory.events.keys()
  ].map(headOf)
  return [...new Set(all)]
}

const pruneMemory =
  (keep: number) =>
  (memory: RunStoreMemory): RunStoreMemory => {
    const heads = orderedHeads(memory)
    const dropped: ReadonlySet<string> = new Set(
      heads.slice(0, Math.max(heads.length - keep, 0))
    )
    return {
      ...memory,
      events: dropHeads(memory.events, dropped),
      baselines: dropHeads(memory.baselines, dropped),
      records: dropHeads(memory.records, dropped)
    }
  }

const makeService = (ref: Ref.Ref<RunStoreMemory>): RunStoreService => ({
  appendEvent: (input) =>
    Ref.update(ref, (m) => {
      const k = `${keyPath(input.key)}/attempt-${String(input.attempt)}`
      const appended = [...(m.events.get(k) ?? []), input.event]
      return { ...m, events: setEntry(m.events, [k, appended]) }
    }),
  readBaseline: (key) =>
    Ref.get(ref).pipe(Effect.map((m) => m.baselines.get(keyPath(key)) ?? null)),
  writeBaseline: (input) =>
    Ref.update(ref, (m) => ({
      ...m,
      baselines: setEntry(m.baselines, [keyPath(input.key), input.baseline])
    })),
  readRecord: (key) =>
    Ref.get(ref).pipe(Effect.map((m) => m.records.get(keyPath(key)) ?? null)),
  writeRecord: (input) =>
    Ref.update(ref, (m) => ({
      ...m,
      records: setEntry(m.records, [keyPath(input.key), input.record])
    })),
  writeProjections: (input) =>
    Ref.update(ref, (m) => ({
      ...m,
      projections: [...m.projections, input]
    })),
  prune: (keep) => Ref.update(ref, pruneMemory(keep))
})

const makeInMemoryRunStore = (): InMemoryRunStore => {
  const ref = Effect.runSync(Ref.make(emptyMemory))
  return { memory: Ref.get(ref), layer: Layer.succeed(RunStore, makeService(ref)) }
}

export { type RunStoreMemory, type InMemoryRunStore, makeInMemoryRunStore }
