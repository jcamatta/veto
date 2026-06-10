import { describe, expect, it } from 'vitest'
import { formatStats } from '../../src/core/stats-format.js'
import type { ReviewerStats } from '../../src/domain/reviewer-stats.js'

const full: ReviewerStats = {
  turns: 4,
  inputTokens: 12450,
  outputTokens: 2100,
  costUsd: 0.084,
  durationMs: 16140,
  toolCalls: 5,
  denials: 2
}

describe('formatStats', () => {
  it('renders every segment when all fields are present', () => {
    expect(formatStats(full)).toBe(
      '4 turns · 12450 in / 2100 out tokens · 5 tool calls (2 denied) · 16.1s · $0.0840'
    )
  })

  it('omits the denial suffix when nothing was denied', () => {
    expect(formatStats({ ...full, denials: 0 })).toContain('5 tool calls ·')
    expect(formatStats({ ...full, denials: 0 })).not.toContain('denied')
  })

  it('drops null segments instead of rendering placeholders', () => {
    const sparse: ReviewerStats = {
      turns: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: null,
      toolCalls: 0,
      denials: 0
    }
    expect(formatStats(sparse)).toBe('0 tool calls')
  })

  it('renders tokens when only one side is known', () => {
    expect(
      formatStats({ ...full, inputTokens: null })
    ).toContain('0 in / 2100 out tokens')
  })
})
