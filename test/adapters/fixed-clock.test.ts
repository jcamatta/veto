import { describe, expect, it } from 'vitest'
import { DateTime, Effect } from 'effect'
import { ReviewClock } from '../../src/ports/clock.js'
import { fixedClock } from './fixed-clock.js'

describe('fixedClock', () => {
  it('always returns the configured instant', async () => {
    const program = Effect.flatMap(ReviewClock, (clock) =>
      Effect.all([clock.now, clock.now])
    )
    const [first, second] = await Effect.runPromise(
      program.pipe(Effect.provide(fixedClock('2026-06-09T14:03:22Z')))
    )
    expect(DateTime.formatIso(first)).toBe('2026-06-09T14:03:22.000Z')
    expect(DateTime.formatIso(second)).toBe('2026-06-09T14:03:22.000Z')
  })
})
