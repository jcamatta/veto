import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DateTime, Effect, Schema } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { fsRunStore } from '../../src/adapters/fs-run-store.js'
import type { Baseline } from '../../src/domain/baseline.js'
import { ReplayServed, ReviewEvent, RunCompleted } from '../../src/domain/review-event.js'
import type { RunKey } from '../../src/domain/run-key.js'
import type { RunRecord } from '../../src/domain/run-record.js'
import { RunStore, type RunStoreService } from '../../src/ports/run-store.js'

const key: RunKey = { head: 'aaa111', branch: 'main', reviewer: 'architect' }

const baseline: Baseline = { attempt: 1, findings: [] }

const record: RunRecord = {
  diffHash: 'dh',
  configHash: 'ch',
  attempt: 1,
  sessionId: null,
  ranAt: DateTime.unsafeMake('2026-06-09T14:03:22Z'),
  durationMs: 1200
}

const projection = {
  ranAt: DateTime.unsafeMake('2026-06-09T14:03:22Z'),
  head: 'aaa111',
  branch: 'main',
  attempt: 1,
  reviewers: [],
  blocking: false
}

const withStore = <A>(
  use: (store: RunStoreService, dir: string) => Effect.Effect<A>
): Promise<A> => {
  const dir = join(mkdtempSync(join(tmpdir(), 'veto-store-')), 'runs')
  return Effect.runPromise(
    Effect.flatMap(RunStore, (store) => use(store, dir)).pipe(
      Effect.provide(fsRunStore(dir)),
      Effect.provide(NodeContext.layer)
    )
  )
}

describe('fsRunStore', () => {
  it('creates the runs dir with a self-gitignore containing *', async () => {
    const dir = await withStore((store, runsDir) =>
      store.writeProjections({ projection, markdown: '# md\n' }).pipe(
        Effect.as(runsDir)
      )
    )
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('*\n')
  })

  it('appends events as decodable JSONL lines per key and attempt', async () => {
    const replay = ReplayServed.make({ reviewer: 'architect' })
    const completed = RunCompleted.make({ blocking: false })
    const dir = await withStore((store, runsDir) =>
      Effect.all([
        store.appendEvent({ key, attempt: 1, event: replay }),
        store.appendEvent({ key, attempt: 1, event: completed }),
        store.appendEvent({ key, attempt: 2, event: replay })
      ]).pipe(Effect.as(runsDir))
    )
    const file = join(dir, 'aaa111', 'architect', 'attempt-1.events.jsonl')
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    const decoded = lines.map((line) =>
      Schema.decodeUnknownSync(Schema.parseJson(ReviewEvent))(line)
    )
    expect(decoded).toEqual([replay, completed])
    expect(
      existsSync(join(dir, 'aaa111', 'architect', 'attempt-2.events.jsonl'))
    ).toBe(true)
  })

  it('round-trips baseline and record, null when missing', async () => {
    const result = await withStore((store) =>
      Effect.gen(function* () {
        const missingBaseline = yield* store.readBaseline(key)
        const missingRecord = yield* store.readRecord(key)
        yield* store.writeBaseline({ key, baseline })
        yield* store.writeRecord({ key, record })
        const storedBaseline = yield* store.readBaseline(key)
        const storedRecord = yield* store.readRecord(key)
        return { missingBaseline, missingRecord, storedBaseline, storedRecord }
      })
    )
    expect(result.missingBaseline).toBeNull()
    expect(result.missingRecord).toBeNull()
    expect(result.storedBaseline).toEqual(baseline)
    expect(result.storedRecord).toEqual(record)
  })

  it('returns null for a corrupted baseline file', async () => {
    const result = await withStore((store, runsDir) =>
      store.writeBaseline({ key, baseline }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            writeFileSync(
              join(runsDir, 'aaa111', 'architect', 'baseline.json'),
              'not json'
            )
          })
        ),
        Effect.andThen(store.readBaseline(key))
      )
    )
    expect(result).toBeNull()
  })

  it('writes latest.json and latest.md projections', async () => {
    const dir = await withStore((store, runsDir) =>
      store
        .writeProjections({ projection, markdown: '# review\n' })
        .pipe(Effect.as(runsDir))
    )
    const json: unknown = JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8'))
    expect(json).toMatchObject({
      head: 'aaa111',
      branch: 'main',
      attempt: 1,
      blocking: false
    })
    expect(readFileSync(join(dir, 'latest.md'), 'utf8')).toBe('# review\n')
  })

  it('reads all events oldest head first, skipping corrupt lines', async () => {
    const replay = ReplayServed.make({ reviewer: 'architect' })
    const completed = RunCompleted.make({ blocking: false })
    const newKey: RunKey = { ...key, head: 'bbb222' }
    const events = await withStore((store, runsDir) =>
      Effect.all([
        store.appendEvent({ key, attempt: 1, event: replay }),
        store.appendEvent({ key, attempt: 2, event: completed }),
        store.appendEvent({ key: newKey, attempt: 1, event: completed })
      ]).pipe(
        Effect.andThen(
          Effect.sync(() => {
            writeFileSync(
              join(runsDir, 'aaa111', 'architect', 'attempt-1.events.jsonl'),
              `${JSON.stringify({ _tag: 'ReplayServed', reviewer: 'architect' })}\nnot json\n{"_tag":"Nope"}\n`
            )
            utimesSync(join(runsDir, 'aaa111'), 1, 1)
            utimesSync(join(runsDir, 'bbb222'), 1000, 1000)
          })
        ),
        Effect.andThen(store.readAllEvents)
      )
    )
    expect(events).toEqual([
      { head: 'aaa111', reviewer: 'architect', event: replay },
      { head: 'aaa111', reviewer: 'architect', event: completed },
      { head: 'bbb222', reviewer: 'architect', event: completed }
    ])
  })

  it('reads no events from a missing runs dir', async () => {
    const events = await withStore((store) => store.readAllEvents)
    expect(events).toEqual([])
  })

  it('prunes everything but the most recent N head dirs', async () => {
    const heads = ['h1', 'h2', 'h3']
    const dir = await withStore((store, runsDir) =>
      Effect.forEach(heads, (head) =>
        store.writeBaseline({ key: { ...key, head }, baseline })
      ).pipe(
        Effect.andThen(store.writeProjections({ projection, markdown: 'md' })),
        Effect.andThen(
          Effect.sync(() => {
            utimesSync(join(runsDir, 'h1'), 1, 1)
            utimesSync(join(runsDir, 'h2'), 1000, 1000)
            utimesSync(join(runsDir, 'h3'), 2000, 2000)
          })
        ),
        Effect.andThen(store.prune(2)),
        Effect.as(runsDir)
      )
    )
    expect(existsSync(join(dir, 'h1'))).toBe(false)
    expect(existsSync(join(dir, 'h2'))).toBe(true)
    expect(existsSync(join(dir, 'h3'))).toBe(true)
    expect(existsSync(join(dir, 'latest.json'))).toBe(true)
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
  })
})
