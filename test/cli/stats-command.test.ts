import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Layer, Option, Ref } from 'effect'
import { Terminal } from '@effect/platform'
import { NodeContext } from '@effect/platform-node'
import { runStats, type StatsArgs } from '../../src/cli/stats-command.js'
import { Schema } from 'effect'
import { RuleStatsReport } from '../../src/domain/rule-stats.js'

const git = (cwd: string, args: readonly string[]): void => {
  execFileSync('git', [...args], { cwd, stdio: 'pipe' })
}

const repo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'veto-stats-'))
  git(dir, ['init', '-b', 'main'])
  return dir
}

const findingLine = (input: {
  readonly rule: string
  readonly severity: string
  readonly fingerprint: string
}): string =>
  JSON.stringify({
    _tag: 'FindingsDecoded',
    reviewer: 'architect',
    findings: [
      {
        severity: input.severity,
        file: 'src/a.ts',
        line: 1,
        rule: input.rule,
        message: 'm',
        fingerprint: input.fingerprint
      }
    ]
  })

const suppressedLine = (fingerprint: string): string =>
  JSON.stringify({ _tag: 'FindingSuppressed', reviewer: 'architect', fingerprint })

const repoWithHistory = (): string => {
  const dir = repo()
  const reviewerDir = join(dir, '.veto', 'runs', 'h1abc1234', 'architect')
  mkdirSync(reviewerDir, { recursive: true })
  writeFileSync(
    join(reviewerDir, 'attempt-1.events.jsonl'),
    [
      findingLine({ rule: 'no-dup', severity: 'error', fingerprint: 'abc123' }),
      findingLine({ rule: 'no-dup', severity: 'warning', fingerprint: 'abc124' }),
      suppressedLine('abc124'),
      'not json at all',
      ''
    ].join('\n')
  )
  return dir
}

type FakeTerminal = {
  readonly outputs: Effect.Effect<readonly string[]>
  readonly layer: Layer.Layer<Terminal.Terminal>
}

const makeFakeTerminal = (): FakeTerminal => {
  const ref = Effect.runSync(Ref.make<readonly string[]>([]))
  const terminal: Terminal.Terminal = {
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    isTTY: Effect.succeed(false),
    readInput: Effect.die('readInput not supported in tests'),
    readLine: Effect.die('readLine not supported in tests'),
    display: (text) => Ref.update(ref, (all) => [...all, text])
  }
  return {
    outputs: Ref.get(ref),
    layer: Layer.succeed(Terminal.Terminal, terminal)
  }
}

const defaultArgs: StatsArgs = {
  dir: Option.none(),
  config: [],
  format: 'pretty'
}

const stats = async (input: {
  readonly cwd: string
  readonly args?: Partial<StatsArgs>
}): Promise<readonly string[]> => {
  const fake = makeFakeTerminal()
  await Effect.runPromise(
    runStats({
      cwd: input.cwd,
      args: { ...defaultArgs, ...input.args }
    }).pipe(Effect.provide(fake.layer), Effect.provide(NodeContext.layer))
  )
  return Effect.runPromise(fake.outputs)
}

describe('runStats', () => {
  it('prints the per-rule table from the retained run history', async () => {
    const outputs = await stats({ cwd: repoWithHistory() })
    const text = outputs.join('')
    expect(text).toContain('rule    fired  suppressed  error  warning  info  last seen')
    expect(text).toContain('no-dup      2           1      1        1     0  h1abc12')
    expect(text).toContain('window: last 10 heads')
  })

  it('prints the empty state when the runs dir has no history', async () => {
    const dir = repo()
    mkdirSync(join(dir, '.veto'))
    const outputs = await stats({ cwd: dir })
    expect(outputs.join('')).toContain('no findings recorded yet')
  })

  it('mirrors the table as a decodable report with --format json', async () => {
    const outputs = await stats({
      cwd: repoWithHistory(),
      args: { format: 'json' }
    })
    const report = Schema.decodeUnknownSync(RuleStatsReport)(
      JSON.parse(outputs.join(''))
    )
    expect(report.retainedHeads).toBe(10)
    expect(report.rules).toEqual([
      {
        rule: 'no-dup',
        fired: 2,
        suppressed: 1,
        severities: { error: 1, warning: 1, info: 0 },
        lastHead: 'h1abc1234'
      }
    ])
  })

  it('anchors the runs dir next to an explicit config target', async () => {
    const dir = repoWithHistory()
    const outputs = await stats({
      cwd: dir,
      args: { config: [join(dir, '.veto', 'architect.yaml')] }
    })
    expect(outputs.join('')).toContain('no-dup')
  })

  it('fails with ConfigError when there is no .veto/ and no target', async () => {
    const dir = repo()
    const exit = await Effect.runPromiseExit(
      runStats({ cwd: dir, args: defaultArgs }).pipe(
        Effect.provide(makeFakeTerminal().layer),
        Effect.provide(NodeContext.layer)
      )
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with GitError outside a git repository', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'veto-stats-norepo-'))
    const exit = await Effect.runPromiseExit(
      runStats({ cwd: dir, args: defaultArgs }).pipe(
        Effect.provide(makeFakeTerminal().layer),
        Effect.provide(NodeContext.layer)
      )
    )
    expect(exit._tag).toBe('Failure')
  })
})
