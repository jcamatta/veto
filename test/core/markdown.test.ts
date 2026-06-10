import { describe, expect, it } from 'vitest'
import { DateTime, Schema } from 'effect'
import { renderMarkdown } from '../../src/core/markdown.js'
import { Fingerprint } from '../../src/domain/finding.js'
import { LatestProjection } from '../../src/domain/latest-projection.js'

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
      resolved: [fp('cccccccccccc')]
    },
    { name: 'frontend', status: 'skipped', findings: [], resolved: [] }
  ],
  blocking: true
}

describe('renderMarkdown', () => {
  it('renders the run header', () => {
    const md = renderMarkdown(projection)
    expect(md).toContain('# Review results')
    expect(md).toContain('1970-01-01')
    expect(md).toContain('`a1b2c3` on `main`')
    expect(md).toContain('attempt: 2')
    expect(md).toContain('blocking: yes')
  })

  it('renders findings with location, rule, suggestion, and fingerprint', () => {
    const md = renderMarkdown(projection)
    expect(md).toContain('## architect — completed')
    expect(md).toContain('**error** `src/a.ts:42` — bad import')
    expect(md).toContain('rule: no cross-layer imports')
    expect(md).toContain('suggestion: route through the service layer')
    expect(md).toContain('fingerprint: `a94f3c21e0b7`')
  })

  it('omits the line and suggestion when absent', () => {
    const md = renderMarkdown(projection)
    expect(md).toContain('**warning** `src/b.ts` — meh')
    expect(md).not.toContain('src/b.ts:')
  })

  it('renders resolved fingerprints and empty reviewers', () => {
    const md = renderMarkdown(projection)
    expect(md).toContain('Resolved since last attempt: `cccccccccccc`')
    expect(md).toContain('## frontend — skipped')
    expect(md).toContain('No findings.')
  })

  it('says blocking: no for a clean run', () => {
    const md = renderMarkdown({ ...projection, blocking: false, reviewers: [] })
    expect(md).toContain('blocking: no')
  })
})
