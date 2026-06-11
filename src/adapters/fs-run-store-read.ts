import type { FileSystem, Path } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Array as Arr, Effect, Either, Option, Order, Schema } from 'effect'
import { ReviewEvent } from '../domain/review-event.js'
import type { StoredEvent } from '../domain/stored-event.js'

type StoreEnv = {
  readonly fs: FileSystem.FileSystem
  readonly path: Path.Path
  readonly runsDir: string
}

type HeadEntry = {
  readonly name: string
  readonly directory: boolean
  readonly mtime: number
}

type EventSource = {
  readonly head: string
  readonly reviewer: string
}

const statEntry =
  (env: StoreEnv) =>
  (name: string): Effect.Effect<HeadEntry, PlatformError> =>
    env.fs.stat(env.path.join(env.runsDir, name)).pipe(
      Effect.map((info) => ({
        name,
        directory: info.type === 'Directory',
        mtime: Option.getOrElse(info.mtime, () => new Date(0)).getTime()
      }))
    )

const headEntries = (env: StoreEnv): Effect.Effect<readonly HeadEntry[]> =>
  env.fs.readDirectory(env.runsDir).pipe(
    Effect.flatMap((names) => Effect.forEach(names, statEntry(env))),
    Effect.map((entries) => entries.filter((entry) => entry.directory)),
    Effect.orElseSucceed(() => [])
  )

const byNewest: Order.Order<HeadEntry> = Order.mapInput(
  Order.reverse(Order.number),
  (entry: HeadEntry) => entry.mtime
)

const attemptPattern = /^attempt-(\d+)\.events\.jsonl$/

const attemptNumber = (name: string): number | null => {
  const match = attemptPattern.exec(name)
  return match?.[1] === undefined ? null : Number(match[1])
}

const byAttempt: Order.Order<{ readonly name: string; readonly attempt: number }> =
  Order.mapInput(Order.number, (entry) => entry.attempt)

const attemptFiles = (names: readonly string[]): readonly string[] =>
  Arr.sort(
    names.flatMap((name) => {
      const attempt = attemptNumber(name)
      return attempt === null ? [] : [{ name, attempt }]
    }),
    byAttempt
  ).map((entry) => entry.name)

const decodeLine = Schema.decodeUnknownEither(Schema.parseJson(ReviewEvent))

const storedOf =
  (source: EventSource) =>
  (line: string): readonly StoredEvent[] =>
    Either.match(decodeLine(line), {
      onLeft: () => [],
      onRight: (event) => [{ ...source, event }]
    })

const fileEvents =
  (env: StoreEnv) =>
  (input: EventSource & { readonly file: string }): Effect.Effect<readonly StoredEvent[]> =>
    env.fs
      .readFileString(
        env.path.join(env.runsDir, input.head, input.reviewer, input.file)
      )
      .pipe(
        Effect.map((text) =>
          text
            .split('\n')
            .filter((line) => line.trim() !== '')
            .flatMap(storedOf({ head: input.head, reviewer: input.reviewer }))
        ),
        Effect.orElseSucceed((): readonly StoredEvent[] => [])
      )

const sourceEvents =
  (env: StoreEnv) =>
  (source: EventSource): Effect.Effect<readonly StoredEvent[]> =>
    env.fs.readDirectory(env.path.join(env.runsDir, source.head, source.reviewer)).pipe(
      Effect.orElseSucceed((): readonly string[] => []),
      Effect.flatMap((names) =>
        Effect.forEach(attemptFiles(names), (file) =>
          fileEvents(env)({ ...source, file })
        )
      ),
      Effect.map((lists) => lists.flat())
    )

const headEvents =
  (env: StoreEnv) =>
  (head: string): Effect.Effect<readonly StoredEvent[]> =>
    env.fs.readDirectory(env.path.join(env.runsDir, head)).pipe(
      Effect.orElseSucceed((): readonly string[] => []),
      Effect.flatMap((reviewers) =>
        Effect.forEach(reviewers, (reviewer) =>
          sourceEvents(env)({ head, reviewer })
        )
      ),
      Effect.map((lists) => lists.flat())
    )

const readAllEvents = (env: StoreEnv): Effect.Effect<readonly StoredEvent[]> =>
  headEntries(env).pipe(
    Effect.map((entries) => Arr.sort(entries, Order.reverse(byNewest))),
    Effect.flatMap((entries) =>
      Effect.forEach(entries, (entry) => headEvents(env)(entry.name))
    ),
    Effect.map((lists) => lists.flat())
  )

export {
  type StoreEnv,
  type HeadEntry,
  headEntries,
  byNewest,
  readAllEvents
}
