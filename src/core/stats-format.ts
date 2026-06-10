import type { ReviewerStats } from '../domain/reviewer-stats.js'

const tokens = (stats: ReviewerStats): string | null =>
  stats.inputTokens === null && stats.outputTokens === null
    ? null
    : `${String(stats.inputTokens ?? 0)} in / ${String(stats.outputTokens ?? 0)} out tokens`

const calls = (stats: ReviewerStats): string =>
  stats.denials === 0
    ? `${String(stats.toolCalls)} tool calls`
    : `${String(stats.toolCalls)} tool calls (${String(stats.denials)} denied)`

const segments = (stats: ReviewerStats): readonly (string | null)[] => [
  stats.turns === null ? null : `${String(stats.turns)} turns`,
  tokens(stats),
  calls(stats),
  stats.durationMs === null ? null : `${(stats.durationMs / 1000).toFixed(1)}s`,
  stats.costUsd === null ? null : `$${stats.costUsd.toFixed(4)}`
]

const formatStats = (stats: ReviewerStats): string =>
  segments(stats)
    .filter((segment): segment is string => segment !== null)
    .join(' · ')

export { formatStats }
