import { Context, DateTime, Effect } from 'effect'

type ReviewClockService = {
  readonly now: Effect.Effect<DateTime.Utc>
}

class ReviewClock extends Context.Tag('veto/ReviewClock')<
  ReviewClock,
  ReviewClockService
>() {}

export { type ReviewClockService, ReviewClock }
