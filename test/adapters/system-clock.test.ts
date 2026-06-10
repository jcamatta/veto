import { describe, expect, it } from 'vitest'
import { DateTime, Effect } from 'effect'
import { systemClockLive } from '../../src/adapters/system-clock.js'
import { ReviewClock } from '../../src/ports/clock.js'

describe('systemClockLive', () => {
  it('returns the current utc time', async () => {
    const before = Date.now()
    const now = await Effect.runPromise(
      Effect.flatMap(ReviewClock, (clock) => clock.now).pipe(
        Effect.provide(systemClockLive)
      )
    )
    const after = Date.now()
    const millis = DateTime.toEpochMillis(now)
    expect(millis).toBeGreaterThanOrEqual(before)
    expect(millis).toBeLessThanOrEqual(after)
  })
})
