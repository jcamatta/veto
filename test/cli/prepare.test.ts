import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
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
  ...overrides
})

const run = (cliArgs: CliArgs): Promise<RunReviewInput> =>
  Effect.runPromise(
    prepare({ args: cliArgs, repoRoot: '/repo' }).pipe(
      Effect.provide(NodeContext.layer)
    )
  )

const runError = (cliArgs: CliArgs): Promise<ConfigError> =>
  Effect.runPromise(
    Effect.flip(prepare({ args: cliArgs, repoRoot: '/repo' })).pipe(
      Effect.provide(NodeContext.layer)
    )
  )

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

  it('fails with ConfigError when no configs are given', async () => {
    const error = await runError(args({}))
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('no reviewer configs given')
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
