import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Layer, Ref } from 'effect'
import { Terminal } from '@effect/platform'
import { NodeContext } from '@effect/platform-node'
import { makeCli, type CliExitCode } from '../../src/cli/command.js'

const validYaml = [
  'name: architect',
  'mode: static',
  'paths:',
  '  - "src/**/*.ts"',
  'systemPrompt: You are an architect.',
  'rules:',
  '  - no cross-layer imports',
  ''
].join('\n')

const invalidYaml = ['name: architect', 'mode: warp-speed', ''].join('\n')

const gitRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'veto-check-'))
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'pipe' })
  return dir
}

const repoWithConfigs = (files: Record<string, string>): string => {
  const dir = gitRepo()
  mkdirSync(join(dir, '.veto'))
  Object.entries(files).forEach(([name, text]) => {
    writeFileSync(join(dir, '.veto', name), text)
  })
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

const runCheckCli = async (input: {
  readonly cwd: string
  readonly argv: readonly string[]
}): Promise<{
  readonly codes: readonly CliExitCode[]
  readonly output: string
}> => {
  const codes = await Effect.runPromise(Ref.make<readonly CliExitCode[]>([]))
  const fake = makeFakeTerminal()
  const cli = makeCli({
    exit: (code) =>
      Ref.update(codes, (recorded) => [...recorded, code]).pipe(
        Effect.zipRight(Effect.interrupt)
      ),
    cwd: input.cwd
  })
  await Effect.runPromiseExit(
    cli(['node', 'veto', 'check', ...input.argv]).pipe(
      Effect.provide(Layer.merge(NodeContext.layer, fake.layer))
    )
  )
  const outputs = await Effect.runPromise(fake.outputs)
  return {
    codes: await Effect.runPromise(Ref.get(codes)),
    output: outputs.join('')
  }
}

describe('veto check', () => {
  it('reports ok per file and exits 0 when every config decodes', async () => {
    const dir = repoWithConfigs({
      'architect.yaml': validYaml,
      'security.yaml': validYaml
    })
    const result = await runCheckCli({ cwd: dir, argv: [join(dir, '.veto')] })
    expect(result.codes).toEqual([0])
    expect(result.output).toContain(`ok ${join(dir, '.veto', 'architect.yaml')}`)
    expect(result.output).toContain(`ok ${join(dir, '.veto', 'security.yaml')}`)
  })

  it('reports the broken file and exits 2 when one config is invalid', async () => {
    const dir = repoWithConfigs({
      'architect.yaml': validYaml,
      'broken.yaml': invalidYaml
    })
    const result = await runCheckCli({ cwd: dir, argv: [join(dir, '.veto')] })
    expect(result.codes).toEqual([2])
    expect(result.output).toContain(`ok ${join(dir, '.veto', 'architect.yaml')}`)
    expect(result.output).toContain(`error invalid config ${join(dir, '.veto', 'broken.yaml')}`)
  })

  it('defaults to .veto/ when no target is given', async () => {
    const dir = repoWithConfigs({ 'architect.yaml': validYaml })
    const result = await runCheckCli({ cwd: dir, argv: [] })
    expect(result.codes).toEqual([0])
  })

  it('accepts repeated --config flags', async () => {
    const dir = repoWithConfigs({ 'architect.yaml': validYaml })
    const result = await runCheckCli({
      cwd: dir,
      argv: ['--config', join(dir, '.veto', 'architect.yaml')]
    })
    expect(result.codes).toEqual([0])
  })

  it('exits 2 when the target does not exist', async () => {
    const dir = gitRepo()
    const result = await runCheckCli({
      cwd: dir,
      argv: [join(dir, 'missing')]
    })
    expect(result.codes).toEqual([2])
  })

  it('exits 2 when .veto/ exists but holds no YAML configs', async () => {
    const dir = repoWithConfigs({})
    const result = await runCheckCli({ cwd: dir, argv: [] })
    expect(result.codes).toEqual([2])
  })

  it('exits 2 when no target is given and the repo has no .veto/', async () => {
    const dir = gitRepo()
    const result = await runCheckCli({ cwd: dir, argv: [] })
    expect(result.codes).toEqual([2])
  })
})
