import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Option } from 'effect'
import { NodeContext } from '@effect/platform-node'
import type { CliArgs } from '../../src/cli/options.js'
import { prepare } from '../../src/cli/prepare.js'
import {
  defaultTimeoutMs,
  type RunReviewInput
} from '../../src/engine/inputs.js'
import type { ConfigError } from '../../src/domain/errors.js'

const configYaml = [
  'name: architect',
  'mode: static',
  'paths:',
  '  - "src/**/*.ts"',
  'systemPrompt: You are an architect.',
  'rules:',
  '  - no cross-layer imports',
  ''
].join('\n')

const configDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'veto-prepare-'))
  writeFileSync(join(dir, 'architect.yaml'), configYaml)
  return dir
}

const args = (overrides: Partial<CliArgs>): CliArgs => ({
  dir: Option.none(),
  config: [],
  staged: true,
  format: 'pretty',
  noCache: false,
  timeout: Option.none(),
  maxCostUsd: Option.none(),
  failOn: 'error',
  ...overrides
})

const runAt = (input: {
  readonly cliArgs: CliArgs
  readonly repoRoot: string
}): Promise<RunReviewInput> =>
  Effect.runPromise(
    prepare({ args: input.cliArgs, repoRoot: input.repoRoot }).pipe(
      Effect.provide(NodeContext.layer)
    )
  )

const run = (cliArgs: CliArgs): Promise<RunReviewInput> =>
  runAt({ cliArgs, repoRoot: '/repo' })

const runErrorAt = (input: {
  readonly cliArgs: CliArgs
  readonly repoRoot: string
}): Promise<ConfigError> =>
  Effect.runPromise(
    Effect.flip(prepare({ args: input.cliArgs, repoRoot: input.repoRoot })).pipe(
      Effect.provide(NodeContext.layer)
    )
  )

const runError = (cliArgs: CliArgs): Promise<ConfigError> =>
  runErrorAt({ cliArgs, repoRoot: '/repo' })

describe('prepare', () => {
  it('builds the run input from a positional config directory', async () => {
    const dir = configDir()
    const prepared = await run(args({ dir: Option.some(dir) }))
    expect(prepared.reviewers.map((r) => r.config.name)).toEqual([
      'architect'
    ])
    expect(prepared.reviewers[0]?.source).toBe(configYaml)
    expect(prepared.settings.repoRoot).toBe('/repo')
    expect(prepared.settings.timeoutMs).toBe(defaultTimeoutMs)
    expect(prepared.settings.strictScope).toBe(false)
    expect(prepared.settings.suppressions.fingerprints).toEqual([])
    expect(prepared.settings.runsDir).toBe(join(dir, 'runs'))
  })

  it('anchors the runs dir next to a --config file', async () => {
    const dir = configDir()
    const file = join(dir, 'architect.yaml')
    const prepared = await run(args({ config: [file] }))
    expect(dirname(prepared.settings.runsDir)).toBe(dir)
    expect(prepared.settings.runsDir).toBe(join(dir, 'runs'))
  })

  it('merges the positional directory with repeated --config files', async () => {
    const dir = configDir()
    const other = configDir()
    const prepared = await run(
      args({
        dir: Option.some(dir),
        config: [join(other, 'architect.yaml')]
      })
    )
    expect(prepared.reviewers).toHaveLength(2)
    expect(prepared.settings.runsDir).toBe(join(dir, 'runs'))
  })

  it('defaults the cost ceiling to null and carries --max-cost-usd through', async () => {
    const dir = configDir()
    const byDefault = await run(args({ dir: Option.some(dir) }))
    expect(byDefault.settings.maxCostUsd).toBeNull()
    const capped = await run(
      args({ dir: Option.some(dir), maxCostUsd: Option.some(0.5) })
    )
    expect(capped.settings.maxCostUsd).toBe(0.5)
  })

  it('maps --timeout seconds onto the run settings in milliseconds', async () => {
    const dir = configDir()
    const prepared = await run(
      args({ dir: Option.some(dir), timeout: Option.some(240) })
    )
    expect(prepared.settings.timeoutMs).toBe(240_000)
  })

  it('propagates the format and no-cache flags into the input', async () => {
    const dir = configDir()
    const prepared = await run(
      args({ dir: Option.some(dir), format: 'json', noCache: true })
    )
    expect(prepared.format).toBe('json')
    expect(prepared.settings.noCache).toBe(true)
  })

  it('carries the fail-on threshold into the run settings', async () => {
    const dir = configDir()
    const byDefault = await run(args({ dir: Option.some(dir) }))
    expect(byDefault.settings.failOn).toBe('error')
    const never = await run(args({ dir: Option.some(dir), failOn: 'never' }))
    expect(never.settings.failOn).toBe('never')
  })

  it('parses the ignore file next to the configs into suppressions', async () => {
    const dir = configDir()
    writeFileSync(
      join(dir, 'ignore'),
      '# comments allowed\na94f3c21e0b7  # architect false positive\n'
    )
    const prepared = await run(args({ dir: Option.some(dir) }))
    expect(prepared.settings.suppressions.fingerprints).toEqual([
      'a94f3c21e0b7'
    ])
  })

  it('defaults to <repoRoot>/.veto when no target is given', async () => {
    const root = mkdtempSync(join(tmpdir(), 'veto-prepare-root-'))
    mkdirSync(join(root, '.veto'))
    writeFileSync(join(root, '.veto', 'architect.yaml'), configYaml)
    const prepared = await runAt({ cliArgs: args({}), repoRoot: root })
    expect(prepared.reviewers.map((r) => r.config.name)).toEqual(['architect'])
    expect(prepared.settings.runsDir).toBe(join(root, '.veto', 'runs'))
  })

  it('prefers explicit targets over the .veto default', async () => {
    const root = mkdtempSync(join(tmpdir(), 'veto-prepare-root-'))
    mkdirSync(join(root, '.veto'))
    writeFileSync(join(root, '.veto', 'architect.yaml'), configYaml)
    const dir = configDir()
    const prepared = await runAt({
      cliArgs: args({ dir: Option.some(dir) }),
      repoRoot: root
    })
    expect(prepared.settings.runsDir).toBe(join(dir, 'runs'))
  })

  it('fails with ConfigError when no configs are given and .veto is absent', async () => {
    const error = await runError(args({}))
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('no reviewer configs found')
    expect(error.message).toContain('veto init')
  })

  it('fails with ConfigError when the config path does not exist', async () => {
    const error = await runError(
      args({ dir: Option.some(join(tmpdir(), 'veto-prepare-missing')) })
    )
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('config path not found')
  })

  it('fails with ConfigError on an invalid suppression file', async () => {
    const dir = configDir()
    writeFileSync(join(dir, 'ignore'), 'not-a-fingerprint\n')
    const error = await runError(args({ dir: Option.some(dir) }))
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('invalid fingerprints')
  })
})
