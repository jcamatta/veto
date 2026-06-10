import { DateTime, Layer } from 'effect'
import { ReviewClock } from '../ports/clock.js'

const systemClockLive: Layer.Layer<ReviewClock> = Layer.succeed(ReviewClock, {
  now: DateTime.now
})

export { systemClockLive }
