import { describe, expect, it } from 'vitest'
import { Effect, Layer, Ref, Stream } from 'effect'
import { fingerprintFinding } from '../../src/core/fingerprint.js'
import type { ModelFinding } from '../../src/domain/finding.js'
import {
  defaultTimeoutMs,
  type ReviewerSource,
  type RunSettings
} from '../../src/engine/inputs.js'
import { runReview } from '../../src/engine/run-review.js'
import { Agent, type AgentStreamItem } from '../../src/ports/agent.js'
import type { Git } from '../../src/ports/git.js'
import { fakeHash } from '../core/fake-hash.js'
import {
  makeCollectorReporter,
  type CollectorReporter
} from '../adapters/collector-reporter.js'
import { fixedClock } from '../adapters/fixed-clock.js'
import { fixtureGit, type FixtureRepo } from '../adapters/fixture-git.js'
import {
  makeInMemoryRunStore,
  type InMemoryRunStore
} from '../adapters/in-memory-run-store.js'
import { scriptedAgent, unavailableAgent, type ScriptStep } from '../adapters/scripted-agent.js'

const repo: FixtureRepo = {
  diff: {
    diffText: '+++ b/src/a.ts\n+const x = 1',
    files: ['src/a.ts']
  },
  head: 'abc123',
  branch: 'main',
  stagedContents: {}
}

const baseSettings: RunSettings = {
  hash: fakeHash,
  repoRoot: '/repo',
  runsDir: '.veto/runs',
  suppressions: { fingerprints: [] },
  noCache: false,
  strictScope: false,
  timeoutMs: 5000
}

const architect: ReviewerSource = {
  config: {
    name: 'architect',
    mode: 'static',
    paths: ['src/**/*.ts'],
    ignore: [],
    systemPrompt: 'You are a software architect.',
    rules: ['no cross-layer imports']
  },
  source: 'architect-config-v1'
}

const docs: ReviewerSource = {
  config: {
    name: 'docs',
    mode: 'static',
    paths: ['docs/**/*.md'],
    ignore: [],
    systemPrompt: 'You review docs.',
    rules: ['keep docs current']
  },
  source: 'docs-config-v1'
}

const errorFinding: ModelFinding = {
  severity: 'error',
  file: 'src/a.ts',
  line: 1,
  rule: 'no cross-layer imports',
  message: 'UI imports the repository directly'
}

const warningFinding: ModelFinding = {
  severity: 'warning',
  file: 'src/a.ts',
  line: 2,
  rule: 'no cross-layer imports',
  message: 'questionable but not blocking'
}

const sayResult = (findings: readonly ModelFinding[]): ScriptStep => ({
  _tag: 'Say',
  raw: {
    type: 'result',
    subtype: 'success',
    result: JSON.stringify({ findings })
  }
})

type World = {
  readonly agent: Layer.Layer<Agent>
  readonly git?: Layer.Layer<Git>
  readonly store?: InMemoryRunStore
  readonly reporter?: CollectorReporter
  readonly settings?: Partial<RunSettings>
  readonly reviewers?: readonly ReviewerSource[]
}

const execute = async (world: World) => {
  const store = world.store ?? makeInMemoryRunStore()
  const reporter = world.reporter ?? makeCollectorReporter()
  const layers = Layer.mergeAll(
    world.git ?? fixtureGit(repo),
    world.agent,
    store.layer,
    reporter.layer,
    fixedClock('2026-06-09T12:00:00Z')
  )
  const code = await Effect.runPromise(
    runReview({
      reviewers: world.reviewers ?? [architect],
      settings: { ...baseSettings, ...world.settings },
      format: 'json'
    }).pipe(Effect.provide(layers))
  )
  const memory = await Effect.runPromise(store.memory)
  const emitted = await Effect.runPromise(reporter.emitted)
  return { code, memory, emitted, store, reporter }
}

const flakyAgent = (responses: readonly unknown[]): Layer.Layer<Agent> => {
  const ref = Effect.runSync(Ref.make(0))
  return Layer.succeed(Agent, {
    run: () =>
      Stream.unwrap(
        Ref.getAndUpdate(ref, (n) => n + 1).pipe(
          Effect.map((n) => {
            const raw = responses[Math.min(n, responses.length - 1)]
            const item: AgentStreamItem = { _tag: 'AgentMessage', raw }
            return Stream.make(item)
          })
        )
      )
  })
}

const neverAgent: Layer.Layer<Agent> = Layer.succeed(Agent, {
  run: () => Stream.never
})

describe('runReview — completed runs', () => {
  it('reviews, fingerprints, persists, reports, and blocks on error findings', async () => {
    const scripted = scriptedAgent([sayResult([errorFinding])])
    const { code, memory, emitted } = await execute({ agent: scripted.layer })
    expect(code).toBe(1)
    const projection = emitted[0]?.projection
    expect(projection?.blocking).toBe(true)
    expect(projection?.head).toBe('abc123')
    expect(projection?.branch).toBe('main')
    expect(projection?.attempt).toBe(1)
    expect(projection?.reviewers[0]).toMatchObject({
      name: 'architect',
      status: 'completed'
    })
    expect(projection?.reviewers[0]?.findings[0]?.fingerprint).toMatch(
      /^[0-9a-f]{12}$/
    )
    expect(memory.records.get('abc123/architect')).toMatchObject({
      attempt: 1,
      sessionId: null
    })
    expect(memory.baselines.get('abc123/architect')?.findings).toHaveLength(1)
    expect(memory.projections).toHaveLength(1)
    expect(memory.projections[0]?.markdown).toContain('architect')
    const events = memory.events.get('abc123/architect/attempt-1') ?? []
    const tags = events.map((e) => e._tag)
    expect(tags).toContain('RunStarted')
    expect(tags).toContain('AgentEvent')
    expect(tags).toContain('FindingsDecoded')
    expect(tags).toContain('BaselineResolved')
  })

  it('passes with exit 0 when only warnings are found', async () => {
    const scripted = scriptedAgent([sayResult([warningFinding])])
    const { code, emitted } = await execute({ agent: scripted.layer })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.blocking).toBe(false)
    expect(emitted[0]?.projection.reviewers[0]?.findings).toHaveLength(1)
  })

  it('sends the full prompt with rules, files, and diff to the agent', async () => {
    const scripted = scriptedAgent([sayResult([])])
    await execute({ agent: scripted.layer })
    const calls = await Effect.runPromise(scripted.calls)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.prompt).toContain('no cross-layer imports')
    expect(calls[0]?.prompt).toContain(repo.diff.diffText)
    expect(calls[0]?.limits.maxTurns).toBe(15)
    expect(calls[0]?.model).toBeNull()
    expect(calls[0]?.effort).toBeNull()
  })

  it('passes per-reviewer model, effort, and maxTurns to the agent', async () => {
    const scripted = scriptedAgent([sayResult([])])
    await execute({
      agent: scripted.layer,
      reviewers: [
        {
          ...architect,
          config: {
            ...architect.config,
            model: 'claude-sonnet-4-6',
            effort: 'medium',
            maxTurns: 8
          }
        }
      ]
    })
    const calls = await Effect.runPromise(scripted.calls)
    expect(calls[0]?.model).toBe('claude-sonnet-4-6')
    expect(calls[0]?.effort).toBe('medium')
    expect(calls[0]?.limits.maxTurns).toBe(8)
  })

  it('lets a reviewer config override the run timeout', async () => {
    const { code, emitted } = await execute({
      agent: neverAgent,
      settings: { timeoutMs: 600_000 },
      reviewers: [
        { ...architect, config: { ...architect.config, timeoutMs: 30 } }
      ]
    })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.status).toBe('unavailable')
  })
})

describe('runReview — scope skip (acceptance 2)', () => {
  it('skips reviewers with no matching staged paths and never calls the agent', async () => {
    const scripted = scriptedAgent([sayResult([])])
    const { code, emitted, memory } = await execute({
      agent: scripted.layer,
      reviewers: [docs]
    })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]).toMatchObject({
      name: 'docs',
      status: 'skipped'
    })
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(0)
    const events = memory.events.get('abc123/docs/attempt-1') ?? []
    expect(events.map((e) => e._tag)).toEqual(['ReviewerSkipped'])
  })

  it('runs matching reviewers and skips the rest', async () => {
    const scripted = scriptedAgent([sayResult([warningFinding])])
    const { emitted } = await execute({
      agent: scripted.layer,
      reviewers: [architect, docs]
    })
    const reviewers = emitted[0]?.projection.reviewers ?? []
    expect(reviewers.map((r) => `${r.name}:${r.status}`)).toEqual([
      'architect:completed',
      'docs:skipped'
    ])
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(1)
  })
})

describe('runReview — Layer-1 replay (acceptance 3)', () => {
  it('replays an identical diff+config from the store with no agent call', async () => {
    const scripted = scriptedAgent([sayResult([errorFinding])])
    const store = makeInMemoryRunStore()
    const first = await execute({ agent: scripted.layer, store })
    const second = await execute({ agent: scripted.layer, store })
    expect(first.code).toBe(1)
    expect(second.code).toBe(1)
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(1)
    expect(second.emitted[0]?.projection.reviewers[0]).toMatchObject({
      status: 'replayed'
    })
    expect(
      second.emitted[0]?.projection.reviewers[0]?.findings
    ).toHaveLength(1)
  })

  it('bypasses the replay cache with noCache', async () => {
    const scripted = scriptedAgent([sayResult([errorFinding])])
    const store = makeInMemoryRunStore()
    await execute({ agent: scripted.layer, store })
    const second = await execute({
      agent: scripted.layer,
      store,
      settings: { noCache: true }
    })
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(2)
    expect(second.emitted[0]?.projection.reviewers[0]).toMatchObject({
      status: 'completed'
    })
    expect(second.emitted[0]?.projection.attempt).toBe(2)
  })

  it('busts the replay cache when the config content changes', async () => {
    const scripted = scriptedAgent([sayResult([])])
    const store = makeInMemoryRunStore()
    await execute({ agent: scripted.layer, store })
    await execute({
      agent: scripted.layer,
      store,
      reviewers: [{ ...architect, source: 'architect-config-v2' }]
    })
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(2)
  })
})

describe('runReview — Layer-2 baseline (acceptance 4)', () => {
  it('injects the baseline on re-run and reports resolved fingerprints', async () => {
    const firstAgent = scriptedAgent([sayResult([errorFinding])])
    const store = makeInMemoryRunStore()
    await execute({ agent: firstAgent.layer, store })
    const fixedRepo: FixtureRepo = {
      ...repo,
      diff: { diffText: '+++ b/src/a.ts\n+const x = 2', files: ['src/a.ts'] }
    }
    const secondAgent = scriptedAgent([sayResult([])])
    const second = await execute({
      agent: secondAgent.layer,
      git: fixtureGit(fixedRepo),
      store
    })
    const calls = await Effect.runPromise(secondAgent.calls)
    expect(calls[0]?.prompt).toContain('Previous findings (attempt 1)')
    expect(calls[0]?.prompt).toContain('No flip-flopping')
    const expected = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding: errorFinding
    }).fingerprint
    const outcome = second.emitted[0]?.projection.reviewers[0]
    expect(outcome?.status).toBe('completed')
    expect(outcome?.findings).toHaveLength(0)
    expect(outcome?.resolved).toEqual([expected])
    expect(second.code).toBe(0)
    expect(second.emitted[0]?.projection.attempt).toBe(2)
  })
})

describe('runReview — suppressions (acceptance 5)', () => {
  it('drops suppressed findings before output and logs the suppression', async () => {
    const fingerprint = fingerprintFinding({
      hash: fakeHash,
      reviewer: 'architect',
      finding: errorFinding
    }).fingerprint
    const scripted = scriptedAgent([sayResult([errorFinding])])
    const { code, emitted, memory } = await execute({
      agent: scripted.layer,
      settings: { suppressions: { fingerprints: [fingerprint] } }
    })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.findings).toHaveLength(0)
    expect(emitted[0]?.projection.blocking).toBe(false)
    const events = memory.events.get('abc123/architect/attempt-1') ?? []
    expect(events.map((e) => e._tag)).toContain('FindingSuppressed')
    expect(memory.baselines.get('abc123/architect')?.findings).toHaveLength(0)
  })
})

describe('runReview — fail-open (acceptance 6)', () => {
  it('fails open with exit 0 when the agent is unavailable', async () => {
    const { code, emitted, memory } = await execute({
      agent: unavailableAgent('credit exhausted')
    })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]).toMatchObject({
      name: 'architect',
      status: 'unavailable',
      failure: 'AgentUnavailable: credit exhausted'
    })
    const events = memory.events.get('abc123/architect/attempt-1') ?? []
    const failed = events.find((e) => e._tag === 'ReviewerFailed')
    expect(failed).toMatchObject({ failOpen: true })
    expect(memory.records.get('abc123/architect')).toBeUndefined()
  })

  it('retries once on parse failure, then fails open', async () => {
    const scripted = scriptedAgent([
      { _tag: 'Say', raw: { type: 'result', result: 'not json at all' } }
    ])
    const { code, emitted } = await execute({ agent: scripted.layer })
    const calls = await Effect.runPromise(scripted.calls)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.prompt).toContain('failed validation')
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.status).toBe('unavailable')
  })

  it('recovers when the retry produces valid findings', async () => {
    const agent = flakyAgent([
      { type: 'result', result: 'garbage' },
      {
        type: 'result',
        result: JSON.stringify({ findings: [warningFinding] })
      }
    ])
    const { code, emitted } = await execute({ agent })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]).toMatchObject({
      status: 'completed'
    })
    expect(emitted[0]?.projection.reviewers[0]?.findings).toHaveLength(1)
  })

  it('fails open when the reviewer times out', async () => {
    const { code, emitted } = await execute({
      agent: neverAgent,
      settings: { timeoutMs: 30 }
    })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.status).toBe('unavailable')
  })

  it('defaults the per-reviewer timeout to 90 seconds', () => {
    expect(defaultTimeoutMs).toBe(90_000)
  })
})

describe('runReview — structured outputs', () => {
  it('passes the findings JSON schema to the agent', async () => {
    const scripted = scriptedAgent([sayResult([])])
    await execute({ agent: scripted.layer })
    const calls = await Effect.runPromise(scripted.calls)
    expect(calls[0]?.outputSchema).toMatchObject({ type: 'object' })
    expect(JSON.stringify(calls[0]?.outputSchema)).toContain('severity')
  })

  it('decodes findings from structured_output without text parsing', async () => {
    const scripted = scriptedAgent([
      {
        _tag: 'Say',
        raw: {
          type: 'result',
          subtype: 'success',
          structured_output: { findings: [errorFinding] }
        }
      }
    ])
    const { code, emitted } = await execute({ agent: scripted.layer })
    expect(code).toBe(1)
    expect(emitted[0]?.projection.reviewers[0]?.findings).toHaveLength(1)
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(1)
  })

  it('fails open without a second session when structured retries are exhausted', async () => {
    const scripted = scriptedAgent([
      {
        _tag: 'Say',
        raw: {
          type: 'result',
          subtype: 'error_max_structured_output_retries',
          is_error: true
        }
      }
    ])
    const { code, emitted } = await execute({ agent: scripted.layer })
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(1)
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.status).toBe('unavailable')
    expect(emitted[0]?.projection.reviewers[0]?.failure).toContain(
      'structured output'
    )
  })

  it('fails open without a retry when structured output misses the schema', async () => {
    const scripted = scriptedAgent([
      {
        _tag: 'Say',
        raw: {
          type: 'result',
          subtype: 'success',
          structured_output: { findings: [{ severity: 'fatal' }] }
        }
      }
    ])
    const { code, emitted } = await execute({ agent: scripted.layer })
    expect(await Effect.runPromise(scripted.calls)).toHaveLength(1)
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.status).toBe('unavailable')
  })
})

describe('runReview — tool-call policy (acceptance 8)', () => {
  it('logs denied tool calls as ToolCallDenied events', async () => {
    const scripted = scriptedAgent([
      { _tag: 'CallTool', tool: 'Read', path: '../outside.txt' },
      { _tag: 'CallTool', tool: 'Read', path: '.veto/runs/latest.json' },
      { _tag: 'CallTool', tool: 'Grep', path: 'src/a.ts' },
      sayResult([])
    ])
    const { code, memory, emitted } = await execute({ agent: scripted.layer })
    expect(code).toBe(0)
    expect(emitted[0]?.projection.reviewers[0]?.stats?.denials).toBe(2)
    const events = memory.events.get('abc123/architect/attempt-1') ?? []
    const denials = events.filter((e) => e._tag === 'ToolCallDenied')
    expect(denials).toHaveLength(2)
    expect(denials[0]).toMatchObject({ tool: 'Read', path: '../outside.txt' })
    expect(denials[1]).toMatchObject({
      path: '.veto/runs/latest.json'
    })
  })

  it('denies reads outside the declared scope when strictScope is on', async () => {
    const scripted = scriptedAgent([
      { _tag: 'CallTool', tool: 'Read', path: 'README.md' },
      { _tag: 'CallTool', tool: 'Read', path: 'src/a.ts' },
      sayResult([])
    ])
    const { memory } = await execute({
      agent: scripted.layer,
      settings: { strictScope: true }
    })
    const events = memory.events.get('abc123/architect/attempt-1') ?? []
    const denials = events.filter((e) => e._tag === 'ToolCallDenied')
    expect(denials).toHaveLength(1)
    expect(denials[0]).toMatchObject({ tool: 'Read', path: 'README.md' })
  })
})

describe('runReview — misuse', () => {
  it('rejects runtime-mode configs with a ConfigError', async () => {
    const runtimeReviewer: ReviewerSource = {
      ...architect,
      config: { ...architect.config, mode: 'runtime' }
    }
    const store = makeInMemoryRunStore()
    const reporter = makeCollectorReporter()
    const layers = Layer.mergeAll(
      fixtureGit(repo),
      scriptedAgent([]).layer,
      store.layer,
      reporter.layer,
      fixedClock('2026-06-09T12:00:00Z')
    )
    const result = await Effect.runPromise(
      Effect.either(
        runReview({
          reviewers: [runtimeReviewer],
          settings: baseSettings,
          format: 'pretty'
        }).pipe(Effect.provide(layers))
      )
    )
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('ConfigError')
      expect(result.left.message).toContain('runtime')
    }
  })
})
