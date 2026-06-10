import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { loadConfigs, type LoadedConfig } from '../../src/adapters/config-loader.js'
import type { ConfigError } from '../../src/domain/errors.js'

const validYaml = (name: string): string =>
  [
    `name: ${name}`,
    'mode: static',
    'paths:',
    '  - "src/**/*.ts"',
    'systemPrompt: |',
    '  You are a reviewer.',
    'rules:',
    '  - keep domain logic out of UI components',
    ''
  ].join('\n')

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'veto-config-'))

const load = (target: string): Promise<readonly LoadedConfig[]> =>
  Effect.runPromise(loadConfigs(target).pipe(Effect.provide(NodeContext.layer)))

const loadError = (target: string): Promise<ConfigError> =>
  Effect.runPromise(
    Effect.flip(loadConfigs(target)).pipe(Effect.provide(NodeContext.layer))
  )

describe('loadConfigs', () => {
  it('loads a single config file with its raw source', async () => {
    const dir = tempDir()
    const file = join(dir, 'architect.yaml')
    writeFileSync(file, validYaml('architect'))
    const loaded = await load(file)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.path).toBe(file)
    expect(loaded[0]?.source).toBe(validYaml('architect'))
    expect(loaded[0]?.config.name).toBe('architect')
    expect(loaded[0]?.config.mode).toBe('static')
    expect(loaded[0]?.config.ignore).toEqual([])
  })

  it('discovers yaml and yml files in a directory, sorted, ignoring others', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'frontend.yml'), validYaml('frontend'))
    writeFileSync(join(dir, 'architect.yaml'), validYaml('architect'))
    writeFileSync(join(dir, 'notes.txt'), 'not a config')
    const loaded = await load(dir)
    expect(loaded.map((entry) => entry.config.name)).toEqual([
      'architect',
      'frontend'
    ])
  })

  it('fails with ConfigError when the path does not exist', async () => {
    const error = await loadError(join(tempDir(), 'missing'))
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('config path not found')
  })

  it('fails with ConfigError when a directory holds no configs', async () => {
    const error = await loadError(tempDir())
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('no reviewer configs found')
  })

  it('fails with ConfigError on malformed YAML', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'broken.yaml'), 'name: [unclosed\nmode: :')
    const error = await loadError(dir)
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('invalid YAML')
  })

  it('fails with ConfigError when the schema rejects the document', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'bad.yaml'), 'name: architect\nmode: static\n')
    const error = await loadError(dir)
    expect(error._tag).toBe('ConfigError')
    expect(error.message).toContain('invalid config')
  })
})
