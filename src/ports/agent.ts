import { Context, Stream } from 'effect'
import type { PolicyDecision } from '../core/tool-policy.js'
import type { AgentUnavailable } from '../domain/errors.js'
import type { ReviewerEffort } from '../domain/reviewer-config.js'

type ToolCallRequest = {
  readonly tool: string
  readonly path: string | null
}

type AgentLimits = {
  readonly maxTurns: number
  readonly maxCostUsd: number | null
}

type JsonSchema = Record<string, unknown>

type AgentRunInput = {
  readonly prompt: string
  readonly system: string
  readonly policy: (call: ToolCallRequest) => PolicyDecision
  readonly limits: AgentLimits
  readonly outputSchema: JsonSchema | null
  readonly model: string | null
  readonly effort: ReviewerEffort | null
}

type AgentMessage = {
  readonly _tag: 'AgentMessage'
  readonly raw: unknown
}

type AgentDenial = {
  readonly _tag: 'AgentDenial'
  readonly tool: string
  readonly path: string
  readonly reason: string
}

type AgentStreamItem = AgentMessage | AgentDenial

type AgentService = {
  readonly run: (
    input: AgentRunInput
  ) => Stream.Stream<AgentStreamItem, AgentUnavailable>
}

class Agent extends Context.Tag('veto/Agent')<Agent, AgentService>() {}

export {
  type ToolCallRequest,
  type AgentLimits,
  type JsonSchema,
  type AgentRunInput,
  type AgentMessage,
  type AgentDenial,
  type AgentStreamItem,
  type AgentService,
  Agent
}
