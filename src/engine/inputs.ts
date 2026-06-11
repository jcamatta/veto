import type { HashFn } from '../core/hashing.js'
import type { FailOn } from '../domain/fail-on.js'
import type { ReviewerConfig } from '../domain/reviewer-config.js'
import type { StagedDiff } from '../domain/staged-diff.js'
import type { SuppressionList } from '../domain/suppression-list.js'
import type { ReportFormat } from '../ports/reporter.js'

type ReviewerSource = {
  readonly config: ReviewerConfig
  readonly source: string
}

type RunSettings = {
  readonly hash: HashFn
  readonly repoRoot: string
  readonly runsDir: string
  readonly suppressions: SuppressionList
  readonly noCache: boolean
  readonly strictScope: boolean
  readonly timeoutMs: number
  readonly maxCostUsd: number | null
  readonly failOn: FailOn
}

type ReviewContext = {
  readonly settings: RunSettings
  readonly diff: StagedDiff
  readonly head: string
  readonly branch: string
}

type RunReviewInput = {
  readonly reviewers: readonly ReviewerSource[]
  readonly settings: RunSettings
  readonly format: ReportFormat
}

const defaultTimeoutMs = 90_000

export {
  type ReviewerSource,
  type RunSettings,
  type ReviewContext,
  type RunReviewInput,
  defaultTimeoutMs
}
