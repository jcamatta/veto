import { ReviewerOutcome } from '../domain/latest-projection.js'

type ExitCode = 0 | 1

const isBlocking = (reviewers: readonly ReviewerOutcome[]): boolean =>
  reviewers.some((r) => r.findings.some((f) => f.severity === 'error'))

const exitCode = (blocking: boolean): ExitCode => (blocking ? 1 : 0)

export { type ExitCode, isBlocking, exitCode }
