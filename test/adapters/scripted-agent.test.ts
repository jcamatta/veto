import { describe, expect, it } from 'vitest'
import { Chunk, Effect, Stream } from 'effect'
import { evaluateToolCall } from '../../src/core/tool-policy.js'
import {
  Agent,
  type AgentRunInput,
  type AgentStreamItem
} from '../../src/ports/agent.js'
import {
  scriptedAgent,
  unavailableAgent,
  type ScriptStep
} from './scripted-agent.js'

const policy: AgentRunInput['policy'] = (call) =>
  evaluateToolCall({
    repoRoot: '/repo',
    tool: call.tool,
    path: call.path === null ? null : `/repo/${call.path}`,
    scope: null
  })

const input: AgentRunInput = {
  prompt: 'review this diff',
  policy,
  limits: { maxTurns: 15 }
}

const collect = (
  layer: ReturnType<typeof scriptedAgent>['layer']
): Promise<readonly AgentStreamItem[]> =>
  Effect.runPromise(
    Effect.flatMap(Agent, (agent) =>
      Stream.runCollect(agent.run(input))
    ).pipe(Effect.provide(layer), Effect.map(Chunk.toReadonlyArray))
  )

describe('scriptedAgent', () => {
  it('streams Say steps as AgentMessage items verbatim', async () => {
    const raw = { type: 'assistant', text: '{"findings":[]}' }
    const { layer } = scriptedAgent([{ _tag: 'Say', raw }])
    expect(await collect(layer)).toEqual([{ _tag: 'AgentMessage', raw }])
  })

  it('runs CallTool steps through the injected policy', async () => {
    const script: readonly ScriptStep[] = [
      { _tag: 'CallTool', tool: 'Read', path: 'src/a.ts' },
      { _tag: 'CallTool', tool: 'Bash', path: null },
      { _tag: 'CallTool', tool: 'Read', path: '.reviewer/runs/latest.json' }
    ]
    const { layer } = scriptedAgent(script)
    const items = await collect(layer)
    expect(items[0]).toEqual({
      _tag: 'AgentMessage',
      raw: { type: 'tool_use', tool: 'Read', path: 'src/a.ts' }
    })
    expect(items[1]).toMatchObject({ _tag: 'AgentDenial', tool: 'Bash' })
    expect(items[2]).toMatchObject({
      _tag: 'AgentDenial',
      tool: 'Read',
      path: '.reviewer/runs/latest.json'
    })
  })

  it('records every run input for assertions', async () => {
    const scripted = scriptedAgent([])
    await collect(scripted.layer)
    await collect(scripted.layer)
    const calls = await Effect.runPromise(scripted.calls)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.prompt).toBe('review this diff')
    expect(calls[0]?.limits.maxTurns).toBe(15)
  })
})

describe('unavailableAgent', () => {
  it('fails the stream with AgentUnavailable', async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(Agent, (agent) =>
        Effect.either(Stream.runCollect(agent.run(input)))
      ).pipe(Effect.provide(unavailableAgent('credit exhausted')))
    )
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toEqual({
        _tag: 'AgentUnavailable',
        message: 'credit exhausted'
      })
    }
  })
})
