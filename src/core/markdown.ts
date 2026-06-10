import { DateTime } from 'effect'
import { Finding } from '../domain/finding.js'
import {
  LatestProjection,
  ReviewerOutcome
} from '../domain/latest-projection.js'

const location = (finding: Finding): string =>
  finding.line === null ? finding.file : `${finding.file}:${String(finding.line)}`

const renderFinding = (finding: Finding): string =>
  [
    `- **${finding.severity}** \`${location(finding)}\` — ${finding.message}`,
    `  - rule: ${finding.rule}`,
    ...(finding.suggestion === undefined
      ? []
      : [`  - suggestion: ${finding.suggestion}`]),
    `  - fingerprint: \`${finding.fingerprint}\``
  ].join('\n')

const renderReviewer = (outcome: ReviewerOutcome): string =>
  [
    `## ${outcome.name} — ${outcome.status}`,
    ...(outcome.findings.length === 0
      ? ['No findings.']
      : outcome.findings.map(renderFinding)),
    ...(outcome.resolved.length === 0
      ? []
      : [
          `Resolved since last attempt: ${outcome.resolved
            .map((fp) => `\`${fp}\``)
            .join(', ')}`
        ])
  ].join('\n\n')

const renderMarkdown = (projection: LatestProjection): string =>
  [
    '# Review results',
    [
      `- ran at: ${DateTime.formatIso(projection.ranAt)}`,
      `- head: \`${projection.head}\` on \`${projection.branch}\``,
      `- attempt: ${String(projection.attempt)}`,
      `- blocking: ${projection.blocking ? 'yes' : 'no'}`
    ].join('\n'),
    ...projection.reviewers.map(renderReviewer)
  ].join('\n\n')

export { renderMarkdown }
