import { Either, Schema } from 'effect'

type Stack = 'electron' | 'next' | 'react' | 'node'

const dependencyMap = Schema.optional(
  Schema.Record({ key: Schema.String, value: Schema.Unknown })
)

const Manifest = Schema.parseJson(
  Schema.Struct({
    dependencies: dependencyMap,
    devDependencies: dependencyMap
  })
)

const decodeManifest = Schema.decodeUnknownEither(Manifest)

const dependencyNames = (manifestText: string): ReadonlySet<string> => {
  const attempt = decodeManifest(manifestText)
  if (Either.isLeft(attempt)) {
    return new Set()
  }
  return new Set([
    ...Object.keys(attempt.right.dependencies ?? {}),
    ...Object.keys(attempt.right.devDependencies ?? {})
  ])
}

const stackOf = (names: ReadonlySet<string>): Stack => {
  if (names.has('electron')) {
    return 'electron'
  }
  if (names.has('next')) {
    return 'next'
  }
  return names.has('react') ? 'react' : 'node'
}

const detectStack = (manifestText: string | null): Stack =>
  manifestText === null ? 'node' : stackOf(dependencyNames(manifestText))

export { type Stack, detectStack }
