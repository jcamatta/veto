import {
  query,
  type CanUseTool,
  type Options,
  type PermissionResult
} from '@anthropic-ai/claude-agent-sdk'
import { Effect, Layer, Queue, Stream } from 'effect'
import { agentUnavailable, type AgentUnavailable } from '../domain/errors.js'
import {
  Agent,
  type AgentDenial,
  type AgentRunInput,
  type AgentStreamItem
} from '../ports/agent.js'

type SdkQuery = AsyncIterable<unknown>

type QueryParams = {
  readonly prompt: string
  readonly options: Options
}

type QueryFn = (params: QueryParams) => SdkQuery

type SdkAgentOptions = {
  readonly repoRoot: string
  readonly queryFn?: QueryFn
}

type RunContext = {
  readonly repoRoot: string
  readonly queryFn: QueryFn
}

type CanUseToolContext = {
  readonly policy: AgentRunInput['policy']
  readonly offerDenial: (denial: AgentDenial) => void
}

const staticTools: readonly string[] = ['Read', 'Grep', 'Glob']

const toolPath = (input: Record<string, unknown>): string | null => {
  const candidate = input.file_path ?? input.path
  return typeof candidate === 'string' ? candidate : null
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const toUnavailable = (error: unknown): AgentUnavailable =>
  agentUnavailable(describeError(error))

const agentMessage = (raw: unknown): AgentStreamItem => ({
  _tag: 'AgentMessage',
  raw
})

const makeCanUseTool =
  (context: CanUseToolContext): CanUseTool =>
  (...args) => {
    const [tool, input] = args
    const path = toolPath(input)
    const decision = context.policy({ tool, path })
    if (decision.allowed) {
      return Promise.resolve<PermissionResult>({
        behavior: 'allow',
        updatedInput: input
      })
    }
    context.offerDenial({
      _tag: 'AgentDenial',
      tool,
      path: path ?? '',
      reason: decision.reason
    })
    return Promise.resolve<PermissionResult>({
      behavior: 'deny',
      message: decision.reason
    })
  }

const buildOptions = (input: {
  readonly context: RunContext
  readonly run: AgentRunInput
  readonly canUseTool: CanUseTool
}): Options => ({
  cwd: input.context.repoRoot,
  tools: [...staticTools],
  allowedTools: [...staticTools],
  maxTurns: input.run.limits.maxTurns,
  ...(input.run.limits.maxCostUsd === null
    ? {}
    : { maxBudgetUsd: input.run.limits.maxCostUsd }),
  settingSources: [],
  canUseTool: input.canUseTool,
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code',
    append: input.run.system,
    excludeDynamicSections: true
  },
  ...(input.run.model === null ? {} : { model: input.run.model }),
  ...(input.run.effort === null ? {} : { effort: input.run.effort }),
  ...(input.run.outputSchema === null
    ? {}
    : {
        outputFormat: {
          type: 'json_schema' as const,
          schema: input.run.outputSchema
        }
      })
})

const openStream = (input: {
  readonly context: RunContext
  readonly run: AgentRunInput
}): Effect.Effect<Stream.Stream<AgentStreamItem, AgentUnavailable>> =>
  Effect.map(Queue.unbounded<AgentStreamItem>(), (denials) => {
    const canUseTool = makeCanUseTool({
      policy: input.run.policy,
      offerDenial: (denial) => {
        Queue.unsafeOffer(denials, denial)
      }
    })
    const options = buildOptions({ ...input, canUseTool })
    const open = Effect.try({
      try: () => input.context.queryFn({ prompt: input.run.prompt, options }),
      catch: toUnavailable
    })
    const messages = Stream.unwrap(
      open.pipe(
        Effect.map((iterable) => Stream.fromAsyncIterable(iterable, toUnavailable))
      )
    )
    return messages.pipe(
      Stream.mapConcatEffect((raw) =>
        Queue.takeAll(denials).pipe(
          Effect.map((pending) => [...pending, agentMessage(raw)])
        )
      ),
      Stream.concat(Stream.fromIterableEffect(Queue.takeAll(denials)))
    )
  })

const sdkAgent = (options: SdkAgentOptions): Layer.Layer<Agent> => {
  const context: RunContext = {
    repoRoot: options.repoRoot,
    queryFn: options.queryFn ?? ((params) => query(params))
  }
  return Layer.succeed(Agent, {
    run: (run) => Stream.unwrap(openStream({ context, run }))
  })
}

export { type QueryParams, type QueryFn, type SdkAgentOptions, sdkAgent }
