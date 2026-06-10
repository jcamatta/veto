import type { ReviewerStats } from '../domain/reviewer-stats.js'

const tokens = (stats: ReviewerStats): string | null =>
  stats.inputTokens === null && stats.outputTokens === null
    ? null
    : `${String(stats.inputTokens ?? 0)} in / ${String(stats.outputTokens ?? 0)} out tokens`

const cache = (stats: ReviewerStats): string | null =>
  stats.cacheCreationTokens === null && stats.cacheReadTokens === null
    ? null
    : `${String(stats.cacheCreationTokens ?? 0)} cache write / ${String(stats.cacheReadTokens ?? 0)} cache read`

const calls = (stats: ReviewerStats): string =>
  stats.denials === 0
    ? `${String(stats.toolCalls)} tool calls`
    : `${String(stats.toolCalls)} tool calls (${String(stats.denials)} denied)`

const segments = (stats: ReviewerStats): readonly (string | null)[] => [
  stats.model,
  stats.turns === null ? null : `${String(stats.turns)} turns`,
  tokens(stats),
  cache(stats),
  calls(stats),
  stats.durationMs === null ? null : `${(stats.durationMs / 1000).toFixed(1)}s`,
  stats.costUsd === null ? null : `$${stats.costUsd.toFixed(4)}`
]

const formatStats = (stats: ReviewerStats): string =>
  segments(stats)
    .filter((segment): segment is string => segment !== null)
    .join(' · ')

export { formatStats }
