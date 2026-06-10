import { describe, expect, it } from 'vitest'
import {
  accumulateMessage,
  bumpDenials,
  emptyStats
} from '../../src/core/agent-stats.js'
import type { ReviewerStats } from '../../src/domain/reviewer-stats.js'

const resultMessage = {
  type: 'result',
  subtype: 'success',
  result: '{"findings":[]}',
  usage: { input_tokens: 1200, output_tokens: 300 },
  total_cost_usd: 0.05,
  num_turns: 4,
  duration_ms: 9000
}

const assistantMessage = {
  type: 'assistant',
  message: {
    content: [
      { type: 'tool_use', name: 'Read' },
      { type: 'text', text: 'looking around' },
      { type: 'tool_use', name: 'Grep' }
    ]
  }
}

describe('accumulateMessage', () => {
  it('starts from all-null usage and zero counters', () => {
    expect(emptyStats).toEqual({
      turns: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: null,
      toolCalls: 0,
      denials: 0
    })
  })

  it('pulls usage, cost, turns, and duration from a result message', () => {
    const stats = accumulateMessage(emptyStats)(resultMessage)
    expect(stats).toEqual({
      turns: 4,
      inputTokens: 1200,
      outputTokens: 300,
      costUsd: 0.05,
      durationMs: 9000,
      toolCalls: 0,
      denials: 0
    })
  })

  it('sums usage across multiple result messages (retry sessions)', () => {
    const first = accumulateMessage(emptyStats)(resultMessage)
    const second = accumulateMessage(first)(resultMessage)
    expect(second.inputTokens).toBe(2400)
    expect(second.turns).toBe(8)
    expect(second.costUsd).toBeCloseTo(0.1)
  })

  it('counts tool_use blocks in assistant messages', () => {
    const stats = accumulateMessage(emptyStats)(assistantMessage)
    expect(stats.toolCalls).toBe(2)
    expect(stats.inputTokens).toBeNull()
  })

  it('ignores result messages without usage fields', () => {
    const stats = accumulateMessage(emptyStats)({
      type: 'result',
      result: '{}'
    })
    expect(stats).toEqual(emptyStats)
  })

  it('ignores unrelated and malformed raw messages', () => {
    const raws: readonly unknown[] = [
      null,
      'text',
      42,
      { type: 'system', subtype: 'thinking_tokens' },
      { type: 'assistant', message: { content: 'not-an-array' } }
    ]
    const stats = raws.reduce<ReviewerStats>(
      (acc, raw) => accumulateMessage(acc)(raw),
      emptyStats
    )
    expect(stats).toEqual(emptyStats)
  })
})

describe('bumpDenials', () => {
  it('increments only the denial counter', () => {
    const stats = bumpDenials(bumpDenials(emptyStats))
    expect(stats.denials).toBe(2)
    expect(stats.toolCalls).toBe(0)
  })
})
