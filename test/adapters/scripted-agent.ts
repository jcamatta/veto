import { Effect, Layer, Ref, Stream } from 'effect'
import { agentUnavailable } from '../../src/domain/errors.js'
import {
  Agent,
  type AgentRunInput,
  type AgentStreamItem
} from '../../src/ports/agent.js'

type SayStep = {
  readonly _tag: 'Say'
  readonly raw: unknown
}

type CallToolStep = {
  readonly _tag: 'CallTool'
  readonly tool: string
  readonly path: string | null
}

type ScriptStep = SayStep | CallToolStep

type ScriptedAgent = {
  readonly layer: Layer.Layer<Agent>
  readonly calls: Effect.Effect<readonly AgentRunInput[]>
}

const playStep =
  (policy: AgentRunInput['policy']) =>
  (step: ScriptStep): AgentStreamItem => {
    if (step._tag === 'Say') {
      return { _tag: 'AgentMessage', raw: step.raw }
    }
    const decision = policy({ tool: step.tool, path: step.path })
    return decision.allowed
      ? {
          _tag: 'AgentMessage',
          raw: { type: 'tool_use', tool: step.tool, path: step.path }
        }
      : {
          _tag: 'AgentDenial',
          tool: step.tool,
          path: step.path ?? '',
          reason: decision.reason
        }
  }

const scriptedAgent = (script: readonly ScriptStep[]): ScriptedAgent => {
  const ref = Effect.runSync(Ref.make<readonly AgentRunInput[]>([]))
  const layer = Layer.succeed(Agent, {
    run: (input) =>
      Stream.unwrap(
        Ref.update(ref, (all) => [...all, input]).pipe(
          Effect.as(Stream.fromIterable(script.map(playStep(input.policy))))
        )
      )
  })
  return { layer, calls: Ref.get(ref) }
}

const unavailableAgent = (message: string): Layer.Layer<Agent> =>
  Layer.succeed(Agent, {
    run: () => Stream.fail(agentUnavailable(message))
  })

export {
  type SayStep,
  type CallToolStep,
  type ScriptStep,
  type ScriptedAgent,
  scriptedAgent,
  unavailableAgent
}
