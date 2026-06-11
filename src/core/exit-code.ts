import type { FailOn } from '../domain/fail-on.js'
import type { Severity } from '../domain/finding.js'
import { ReviewerOutcome } from '../domain/latest-projection.js'

type ExitCode = 0 | 1

const rank: Record<Severity, number> = { info: 0, warning: 1, error: 2 }

const blocksAt =
  (threshold: FailOn) =>
  (reviewers: readonly ReviewerOutcome[]): boolean =>
    threshold !== 'never' &&
    reviewers.some((r) =>
      r.findings.some((f) => rank[f.severity] >= rank[threshold])
    )

const isBlocking = blocksAt('error')

const exitCode = (blocking: boolean): ExitCode => (blocking ? 1 : 0)

export { type ExitCode, blocksAt, isBlocking, exitCode }
