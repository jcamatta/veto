import { DateTime, Effect, Layer } from 'effect'
import { ReviewClock } from '../../src/ports/clock.js'

const fixedClock = (iso: string): Layer.Layer<ReviewClock> =>
  Layer.succeed(ReviewClock, {
    now: Effect.succeed(DateTime.unsafeMake(iso))
  })

export { fixedClock }
