import { describe, expect, it } from 'vitest'
import { DateTime, Schema } from 'effect'
import { renderPretty } from '../../src/core/pretty.js'
import { Fingerprint } from '../../src/domain/finding.js'
import type { LatestProjection } from '../../src/domain/latest-projection.js'

const fp = Schema.decodeSync(Fingerprint)

const projection: LatestProjection = {
  ranAt: DateTime.unsafeMake(0),
  head: 'a1b2c3',
  branch: 'main',
  attempt: 2,
  reviewers: [
    {
      name: 'architect',
      status: 'completed',
      findings: [
        {
          severity: 'error',
          file: 'src/a.ts',
          line: 42,
          rule: 'no cross-layer imports',
          message: 'bad import',
          suggestion: 'route through the service layer',
          fingerprint: fp('a94f3c21e0b7')
        },
        {
          severity: 'warning',
          file: 'src/b.ts',
          line: null,
          rule: 'r2',
          message: 'meh',
          fingerprint: fp('beefbeefbeef')
        }
      ],
      resolved: [fp('cccccccccccc')],
      stats: {
        model: 'claude-sonnet-4-6',
        turns: 4,
        inputTokens: 12450,
        cacheCreationTokens: 7000,
        cacheReadTokens: 90000,
        outputTokens: 2100,
        costUsd: 0.084,
        durationMs: 16140,
        toolCalls: 5,
        denials: 2
      }
    },
    { name: 'frontend', status: 'skipped', findings: [], resolved: [] },
    {
      name: 'security',
      status: 'unavailable',
      findings: [],
      resolved: [],
      failure: "TimeoutException: Operation timed out after '1m 30s'"
    }
  ],
  blocking: true
}

describe('renderPretty', () => {
  it('renders the run header with head, branch and attempt', () => {
    const text = renderPretty(projection)
    expect(text).toContain('veto — 1970-01-01T00:00:00.000Z')
    expect(text).toContain('head a1b2c3 on main, attempt 2')
  })

  it('renders findings with location, rule and optional suggestion', () => {
    const text = renderPretty(projection)
    expect(text).toContain(
      '  [error] src/a.ts:42 — bad import (no cross-layer imports)'
    )
    expect(text).toContain('    suggestion: route through the service layer')
    expect(text).toContain('  [warning] src/b.ts — meh (r2)')
  })

  it('renders resolved fingerprints and reviewer statuses', () => {
    const text = renderPretty(projection)
    expect(text).toContain('architect: completed')
    expect(text).toContain('  resolved: cccccccccccc')
    expect(text).toContain('frontend: skipped, no findings')
  })

  it('marks blocking runs and points at the full report', () => {
    const text = renderPretty(projection)
    expect(text).toContain('BLOCKING: error findings present.')
    expect(text).toContain('Full report: .veto/runs/latest.md')
  })

  it('marks non-blocking runs', () => {
    const text = renderPretty({ ...projection, blocking: false })
    expect(text).toContain('Not blocking.')
  })

  it('renders the stats line when stats are present', () => {
    const text = renderPretty(projection)
    expect(text).toContain(
      '  claude-sonnet-4-6 · 4 turns · 12450 in / 2100 out tokens · 7000 cache write / 90000 cache read · 5 tool calls (2 denied) · 16.1s · $0.0840'
    )
  })

  it('renders the fail-open cause for unavailable reviewers', () => {
    const text = renderPretty(projection)
    expect(text).toContain(
      "  failed open: TimeoutException: Operation timed out after '1m 30s'"
    )
  })
})
