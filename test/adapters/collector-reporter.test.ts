import { describe, expect, it } from 'vitest'
import { DateTime, Effect } from 'effect'
import type { LatestProjection } from '../../src/domain/latest-projection.js'
import { Reporter } from '../../src/ports/reporter.js'
import { makeCollectorReporter } from './collector-reporter.js'

const projection: LatestProjection = {
  ranAt: DateTime.unsafeMake('2026-06-09T14:03:22Z'),
  head: 'aaa111',
  branch: 'main',
  attempt: 1,
  reviewers: [],
  blocking: false
}

describe('makeCollectorReporter', () => {
  it('collects emitted projections with their format, in order', async () => {
    const collector = makeCollectorReporter()
    await Effect.runPromise(
      Effect.flatMap(Reporter, (reporter) =>
        Effect.all([
          reporter.emit({ projection, format: 'pretty' }),
          reporter.emit({ projection, format: 'json' })
        ])
      ).pipe(Effect.provide(collector.layer))
    )
    expect(await Effect.runPromise(collector.emitted)).toEqual([
      { projection, format: 'pretty' },
      { projection, format: 'json' }
    ])
  })

  it('starts empty', async () => {
    const emitted = await Effect.runPromise(makeCollectorReporter().emitted)
    expect(emitted).toEqual([])
  })
})
