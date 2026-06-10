import { Baseline } from '../domain/baseline.js'
import { Finding, Fingerprint } from '../domain/finding.js'

type BaselineDiffInput = {
  readonly baseline: Baseline | null
  readonly current: readonly Finding[]
}

type BaselineDiff = {
  readonly resolved: readonly Fingerprint[]
  readonly persisting: readonly Finding[]
  readonly fresh: readonly Finding[]
}

const diffBaseline = ({ baseline, current }: BaselineDiffInput): BaselineDiff => {
  const previous = baseline?.findings ?? []
  const currentFingerprints = new Set<string>(
    current.map((f) => f.fingerprint)
  )
  const previousFingerprints = new Set<string>(
    previous.map((f) => f.fingerprint)
  )
  const resolved = previous
    .filter((f) => !currentFingerprints.has(f.fingerprint))
    .map((f) => f.fingerprint)
  const persisting = current.filter((f) =>
    previousFingerprints.has(f.fingerprint)
  )
  const fresh = current.filter(
    (f) => !previousFingerprints.has(f.fingerprint)
  )
  return { resolved, persisting, fresh }
}

export { type BaselineDiffInput, type BaselineDiff, diffBaseline }
