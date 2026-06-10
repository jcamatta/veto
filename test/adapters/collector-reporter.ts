import { Effect, Layer, Ref } from 'effect'
import { Reporter, type EmitInput } from '../../src/ports/reporter.js'

type CollectorReporter = {
  readonly layer: Layer.Layer<Reporter>
  readonly emitted: Effect.Effect<readonly EmitInput[]>
}

const makeCollectorReporter = (): CollectorReporter => {
  const ref = Effect.runSync(Ref.make<readonly EmitInput[]>([]))
  const layer = Layer.succeed(Reporter, {
    emit: (input) => Ref.update(ref, (all) => [...all, input])
  })
  return { layer, emitted: Ref.get(ref) }
}

export { type CollectorReporter, makeCollectorReporter }
