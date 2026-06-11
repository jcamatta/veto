import { describe, expect, it } from 'vitest'
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import { Chunk, Effect, Stream } from 'effect'
import {
  sdkAgent,
  type QueryFn,
  type QueryParams
} from '../../src/adapters/sdk-agent.js'
import type { AgentUnavailable } from '../../src/domain/errors.js'
import {
  Agent,
  type AgentRunInput,
  type AgentStreamItem
} from '../../src/ports/agent.js'

const callOptions = {
  signal: new AbortController().signal,
  toolUseID: 'tool-1'
}

const allowReads: AgentRunInput['policy'] = (call) =>
  call.tool === 'Read'
    ? { allowed: true }
    : { allowed: false, reason: `tool "${call.tool}" is not allowed` }

const runInput = (policy: AgentRunInput['policy']): AgentRunInput => ({
  prompt: 'review this diff',
  system: 'You are a reviewer.',
  policy,
  limits: { maxTurns: 15, maxCostUsd: null },
  outputSchema: { type: 'object' },
  model: null,
  effort: null
})

const decideWith = (
  params: QueryParams
): ((tool: string, input: Record<string, unknown>) => Promise<PermissionResult>) => {
  const canUseTool = params.options.canUseTool
  return canUseTool === undefined
    ? () => Promise.resolve({ behavior: 'deny', message: 'no callback wired' })
    : (tool, input) => canUseTool(tool, input, callOptions)
}

const collect = (
  queryFn: QueryFn,
  input: AgentRunInput
): Promise<readonly AgentStreamItem[]> =>
  Effect.runPromise(
    Effect.flatMap(Agent, (agent) => Stream.runCollect(agent.run(input))).pipe(
      Effect.map(Chunk.toReadonlyArray),
      Effect.provide(sdkAgent({ repoRoot: '/repo', queryFn }))
    )
  )

const collectError = (
  queryFn: QueryFn,
  input: AgentRunInput
): Promise<AgentUnavailable> =>
  Effect.runPromise(
    Effect.flatMap(Agent, (agent) =>
      Effect.flip(Stream.runCollect(agent.run(input)))
    ).pipe(Effect.provide(sdkAgent({ repoRoot: '/repo', queryFn })))
  )

describe('sdkAgent', () => {
  it('streams every sdk message in order as AgentMessage', async () => {
    const queryFn: QueryFn = () => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield { type: 'system' }
        yield { type: 'result' }
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    expect(items).toEqual([
      { _tag: 'AgentMessage', raw: { type: 'system' } },
      { _tag: 'AgentMessage', raw: { type: 'result' } }
    ])
  })

  it('configures the sdk with read-only tools, maxTurns, cwd and no settings', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield params
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    expect(items[0]?._tag).toBe('AgentMessage')
    expect(items[0]).toMatchObject({
      raw: {
        prompt: 'review this diff',
        options: {
          cwd: '/repo',
          tools: ['Read', 'Grep', 'Glob'],
          allowedTools: ['Read', 'Grep', 'Glob'],
          maxTurns: 15,
          settingSources: [],
          outputFormat: { type: 'json_schema', schema: { type: 'object' } }
        }
      }
    })
    expect(JSON.stringify(items[0])).not.toContain('maxBudgetUsd')
  })

  it('forwards a cost ceiling to the sdk as maxBudgetUsd', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield params
      }
    })
    const capped: AgentRunInput = {
      ...runInput(allowReads),
      limits: { maxTurns: 15, maxCostUsd: 0.5 }
    }
    const items = await collect(queryFn, capped)
    expect(items[0]).toMatchObject({
      raw: { options: { maxBudgetUsd: 0.5 } }
    })
  })

  it('sends the system text on the claude_code preset, cacheable', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield params
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    expect(items[0]).toMatchObject({
      raw: {
        options: {
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: 'You are a reviewer.',
            excludeDynamicSections: true
          }
        }
      }
    })
  })

  it('passes model and effort through to the sdk options when set', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield params
      }
    })
    const items = await collect(queryFn, {
      ...runInput(allowReads),
      model: 'claude-sonnet-4-6',
      effort: 'medium'
    })
    expect(items[0]).toMatchObject({
      raw: { options: { model: 'claude-sonnet-4-6', effort: 'medium' } }
    })
  })

  it('omits model and effort from the sdk options when unset', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield params
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    const first = items[0]
    expect(first?._tag).toBe('AgentMessage')
    if (first?._tag === 'AgentMessage') {
      const raw = first.raw as QueryParams
      expect('model' in raw.options).toBe(false)
      expect('effort' in raw.options).toBe(false)
    }
  })

  it('omits outputFormat when no output schema is requested', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield params
      }
    })
    const items = await collect(queryFn, {
      ...runInput(allowReads),
      outputSchema: null
    })
    const first = items[0]
    expect(first?._tag).toBe('AgentMessage')
    if (first?._tag === 'AgentMessage') {
      const raw = first.raw as QueryParams
      expect('outputFormat' in raw.options).toBe(false)
    }
  })

  it('allows policy-approved tool calls without emitting denials', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        yield await decideWith(params)('Read', { file_path: 'src/a.ts' })
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    expect(items).toEqual([
      {
        _tag: 'AgentMessage',
        raw: { behavior: 'allow', updatedInput: { file_path: 'src/a.ts' } }
      }
    ])
  })

  it('denies vetoed tool calls and emits AgentDenial before later messages', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        yield await decideWith(params)('Bash', { path: '/etc/passwd' })
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    expect(items).toEqual([
      {
        _tag: 'AgentDenial',
        tool: 'Bash',
        path: '/etc/passwd',
        reason: 'tool "Bash" is not allowed'
      },
      {
        _tag: 'AgentMessage',
        raw: { behavior: 'deny', message: 'tool "Bash" is not allowed' }
      }
    ])
  })

  it('drains a denial raised after the final message', async () => {
    const queryFn: QueryFn = (params) => ({
      [Symbol.asyncIterator]: async function* () {
        yield 'only'
        await decideWith(params)('Write', {})
      }
    })
    const items = await collect(queryFn, runInput(allowReads))
    expect(items).toEqual([
      { _tag: 'AgentMessage', raw: 'only' },
      {
        _tag: 'AgentDenial',
        tool: 'Write',
        path: '',
        reason: 'tool "Write" is not allowed'
      }
    ])
  })

  it('maps stream failures to AgentUnavailable', async () => {
    const queryFn: QueryFn = () => ({
      [Symbol.asyncIterator]: async function* () {
        await Promise.resolve()
        yield 'one'
        throw new Error('credit exhausted')
      }
    })
    const error = await collectError(queryFn, runInput(allowReads))
    expect(error._tag).toBe('AgentUnavailable')
    expect(error.message).toBe('credit exhausted')
  })

  it('maps a synchronously failing query to AgentUnavailable', async () => {
    const queryFn: QueryFn = () => {
      throw new Error('claude binary not found')
    }
    const error = await collectError(queryFn, runInput(allowReads))
    expect(error._tag).toBe('AgentUnavailable')
    expect(error.message).toBe('claude binary not found')
  })
})
