import { FileSystem, Path } from '@effect/platform'
import { Array as Arr, Effect, Layer, Schema } from 'effect'
import { Baseline } from '../domain/baseline.js'
import { LatestProjection } from '../domain/latest-projection.js'
import { ReviewEvent } from '../domain/review-event.js'
import type { RunKey } from '../domain/run-key.js'
import { RunRecord } from '../domain/run-record.js'
import { RunStore, type RunStoreService } from '../ports/run-store.js'
import {
  byNewest,
  headEntries,
  readAllEvents,
  type StoreEnv
} from './fs-run-store-read.js'

const keyDir =
  (env: StoreEnv) =>
  (key: RunKey): string =>
    env.path.join(env.runsDir, key.head, key.reviewer)

const baselineFile =
  (env: StoreEnv) =>
  (key: RunKey): string =>
    env.path.join(keyDir(env)(key), 'baseline.json')

const recordFile =
  (env: StoreEnv) =>
  (key: RunKey): string =>
    env.path.join(keyDir(env)(key), 'record.json')

const ensureBase = (env: StoreEnv): Effect.Effect<void> =>
  env.fs.makeDirectory(env.runsDir, { recursive: true }).pipe(
    Effect.andThen(() => {
      const ignorePath = env.path.join(env.runsDir, '.gitignore')
      return env.fs
        .exists(ignorePath)
        .pipe(
          Effect.flatMap((present) =>
            present ? Effect.void : env.fs.writeFileString(ignorePath, '*\n')
          )
        )
    }),
    Effect.orDie
  )

const ensureKeyDir =
  (env: StoreEnv) =>
  (key: RunKey): Effect.Effect<void> =>
    ensureBase(env).pipe(
      Effect.andThen(
        env.fs.makeDirectory(keyDir(env)(key), { recursive: true })
      ),
      Effect.orDie
    )

const encodeJson =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (value: A): Effect.Effect<string> =>
    Schema.encode(schema)(value).pipe(
      Effect.map((encoded) => JSON.stringify(encoded, null, 2)),
      Effect.orDie
    )

const readJson =
  (env: StoreEnv) =>
  <A, I>(input: {
    readonly file: string
    readonly schema: Schema.Schema<A, I>
  }): Effect.Effect<A | null> =>
    env.fs
      .readFileString(input.file)
      .pipe(
        Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(input.schema))),
        Effect.orElseSucceed(() => null)
      )

const writeFile =
  (env: StoreEnv) =>
  (input: { readonly file: string; readonly data: string }): Effect.Effect<void> =>
    env.fs.writeFileString(input.file, input.data).pipe(Effect.orDie)

const appendEvent =
  (env: StoreEnv): RunStoreService['appendEvent'] =>
  (input) =>
    ensureKeyDir(env)(input.key).pipe(
      Effect.andThen(Schema.encode(ReviewEvent)(input.event).pipe(Effect.orDie)),
      Effect.flatMap((encoded) =>
        env.fs
          .writeFileString(
            env.path.join(
              keyDir(env)(input.key),
              `attempt-${String(input.attempt)}.events.jsonl`
            ),
            `${JSON.stringify(encoded)}\n`,
            { flag: 'a' }
          )
          .pipe(Effect.orDie)
      )
    )

const writeProjections =
  (env: StoreEnv): RunStoreService['writeProjections'] =>
  (input) =>
    ensureBase(env).pipe(
      Effect.andThen(encodeJson(LatestProjection)(input.projection)),
      Effect.flatMap((json) =>
        Effect.all([
          writeFile(env)({
            file: env.path.join(env.runsDir, 'latest.json'),
            data: json
          }),
          writeFile(env)({
            file: env.path.join(env.runsDir, 'latest.md'),
            data: input.markdown
          })
        ])
      ),
      Effect.asVoid
    )

const prune =
  (env: StoreEnv): RunStoreService['prune'] =>
  (keep) =>
    headEntries(env).pipe(
      Effect.map((entries) => Arr.sort(entries, byNewest).slice(keep)),
      Effect.flatMap((stale) =>
        Effect.forEach(stale, (entry) =>
          env.fs
            .remove(env.path.join(env.runsDir, entry.name), {
              recursive: true
            })
            .pipe(Effect.ignore)
        )
      ),
      Effect.asVoid
    )

const makeService = (env: StoreEnv): RunStoreService => ({
  appendEvent: appendEvent(env),
  readAllEvents: readAllEvents(env),
  readBaseline: (key) =>
    readJson(env)({ file: baselineFile(env)(key), schema: Baseline }),
  writeBaseline: (input) =>
    ensureKeyDir(env)(input.key).pipe(
      Effect.andThen(encodeJson(Baseline)(input.baseline)),
      Effect.flatMap((data) =>
        writeFile(env)({ file: baselineFile(env)(input.key), data })
      )
    ),
  readRecord: (key) =>
    readJson(env)({ file: recordFile(env)(key), schema: RunRecord }),
  writeRecord: (input) =>
    ensureKeyDir(env)(input.key).pipe(
      Effect.andThen(encodeJson(RunRecord)(input.record)),
      Effect.flatMap((data) =>
        writeFile(env)({ file: recordFile(env)(input.key), data })
      )
    ),
  writeProjections: writeProjections(env),
  prune: prune(env)
})

const fsRunStore = (
  runsDir: string
): Layer.Layer<RunStore, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    RunStore,
    Effect.all({ fs: FileSystem.FileSystem, path: Path.Path }).pipe(
      Effect.map((services) => makeService({ ...services, runsDir }))
    )
  )

export { fsRunStore }
