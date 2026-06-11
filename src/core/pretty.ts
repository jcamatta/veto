import { DateTime } from 'effect'
import type { Finding } from '../domain/finding.js'
import type {
  LatestProjection,
  ReviewerOutcome
} from '../domain/latest-projection.js'
import { formatStats } from './stats-format.js'

const location = (finding: Finding): string =>
  finding.line === null ? finding.file : `${finding.file}:${String(finding.line)}`

const renderFinding = (finding: Finding): string =>
  [
    `  [${finding.severity}] ${location(finding)} — ${finding.message} (${finding.rule})`,
    ...(finding.suggestion === undefined
      ? []
      : [`    suggestion: ${finding.suggestion}`])
  ].join('\n')

const summary = (outcome: ReviewerOutcome): string =>
  outcome.findings.length === 0 ? ', no findings' : ''

const renderReviewer = (outcome: ReviewerOutcome): string =>
  [
    `${outcome.name}: ${outcome.status}${summary(outcome)}`,
    ...(outcome.failure === undefined
      ? []
      : [`  failed open: ${outcome.failure}`]),
    ...(outcome.skipReason === undefined
      ? []
      : [`  skipped: ${outcome.skipReason}`]),
    ...(outcome.stats === undefined ? [] : [`  ${formatStats(outcome.stats)}`]),
    ...outcome.findings.map(renderFinding),
    ...(outcome.resolved.length === 0
      ? []
      : [`  resolved: ${outcome.resolved.join(', ')}`])
  ].join('\n')

const renderPretty = (projection: LatestProjection): string =>
  [
    `veto — ${DateTime.formatIso(projection.ranAt)}`,
    `head ${projection.head} on ${projection.branch}, attempt ${String(projection.attempt)}`,
    '',
    ...projection.reviewers.map(renderReviewer),
    '',
    projection.blocking
      ? 'BLOCKING: findings at or above the fail-on threshold.'
      : 'Not blocking.',
    'Full report: .veto/runs/latest.md'
  ].join('\n')

export { renderPretty }
