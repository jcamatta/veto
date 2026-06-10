import { Either, Schema } from 'effect'
import { type ConfigError, configError } from '../domain/errors.js'
import { Finding, Fingerprint } from '../domain/finding.js'
import { SuppressionList } from '../domain/suppression-list.js'
import { type Result, err, ok } from './result.js'

type FilterInput = {
  readonly findings: readonly Finding[]
  readonly suppressions: SuppressionList
}

type FilterOutput = {
  readonly kept: readonly Finding[]
  readonly suppressed: readonly Fingerprint[]
}

const decodeFingerprint = Schema.decodeUnknownEither(Fingerprint)

const stripComment = (line: string): string =>
  line.split('#')[0]?.trim() ?? ''

const parseSuppressions = (
  text: string
): Result<SuppressionList, ConfigError> => {
  const entries = text.split('\n').map(stripComment).filter((line) => line !== '')
  const decoded = entries.map((entry) => ({
    entry,
    result: decodeFingerprint(entry)
  }))
  const invalid = decoded.filter(({ result }) => Either.isLeft(result))
  if (invalid.length > 0) {
    const lines = invalid.map(({ entry }) => entry).join(', ')
    return err(configError(`invalid fingerprints in suppression file: ${lines}`))
  }
  const fingerprints = decoded.flatMap(({ result }) =>
    Either.isRight(result) ? [result.right] : []
  )
  return ok({ fingerprints })
}

const filterSuppressed = ({
  findings,
  suppressions
}: FilterInput): FilterOutput => {
  const suppressedSet = new Set<string>(suppressions.fingerprints)
  const kept = findings.filter((f) => !suppressedSet.has(f.fingerprint))
  const suppressed = findings
    .filter((f) => suppressedSet.has(f.fingerprint))
    .map((f) => f.fingerprint)
  return { kept, suppressed }
}

export {
  type FilterInput,
  type FilterOutput,
  parseSuppressions,
  filterSuppressed
}
