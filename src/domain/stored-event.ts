import type { ReviewEvent } from './review-event.js'

type StoredEvent = {
  readonly head: string
  readonly reviewer: string
  readonly event: ReviewEvent
}

export { type StoredEvent }
