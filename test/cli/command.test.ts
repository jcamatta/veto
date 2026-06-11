import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Exit, Ref } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { makeCli, type CliExitCode } from '../../src/cli/command.js'
import type { QueryFn } from '../../src/adapters/sdk-agent.js'
import type { ModelFinding } from '../../src/domain/finding.js'

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

const git = (cwd: string, args: readonly string[]): void => {
  execFileSync('git', [...args], { cwd, stdio: 'pipe' })
}

const repoWithoutVeto = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'veto-cli-'))
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'base.txt'), 'base\n')
  git(dir, ['add', 'base.txt'])
  git(dir, ['commit', '-m', 'initial'])
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src', 'a.ts'), 'const x = 1\n')
  git(dir, ['add', 'src/a.ts'])
  return dir
}

const repoWithStagedChange = (): string => {
  const dir = repoWithoutVeto()
  mkdirSync(join(dir, '.veto'))
  writeFileSync(join(dir, '.veto', 'architect.yaml'), configYaml)
  return dir
}

const queryFor =
  (findings: readonly ModelFinding[]): QueryFn =>
  () => ({
    [Symbol.asyncIterator]: async function* () {
      await Promise.resolve()
      yield {
        type: 'result',
        subtype: 'success',
        result: JSON.stringify({ findings })
      }
    }
  })

const errorFinding: ModelFinding = {
  severity: 'error',
  file: 'src/a.ts',
  line: 1,
  rule: 'no cross-layer imports',
  message: 'module reaches across layers'
}

type CliRun = {
  readonly codes: readonly CliExitCode[]
  readonly exit: Exit.Exit<void>
}

const runCli = async (input: {
  readonly cwd: string
  readonly argv: readonly string[]
  readonly findings?: readonly ModelFinding[]
}): Promise<CliRun> => {
  const codes = await Effect.runPromise(Ref.make<readonly CliExitCode[]>([]))
  const cli = makeCli({
    exit: (code) =>
      Ref.update(codes, (recorded) => [...recorded, code]).pipe(
        Effect.zipRight(Effect.interrupt)
      ),
    cwd: input.cwd,
    queryFn: queryFor(input.findings ?? [])
  })
  const exit = await Effect.runPromiseExit(
    cli(['node', 'veto', ...input.argv]).pipe(Effect.provide(NodeContext.layer))
  )
  return { codes: await Effect.runPromise(Ref.get(codes)), exit }
}

describe('makeCli', () => {
  it('reviews a staged diff, writes projections, and exits 0 when clean', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--staged']
    })
    expect(result.codes).toEqual([0])
    const latest = join(dir, '.veto', 'runs', 'latest.json')
    expect(existsSync(latest)).toBe(true)
    expect(existsSync(join(dir, '.veto', 'runs', 'latest.md'))).toBe(true)
    expect(readFileSync(latest, 'utf8')).toContain('"architect"')
  })

  it('exits 1 when a reviewer reports an error-severity finding', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--staged', '--format=json'],
      findings: [errorFinding]
    })
    expect(result.codes).toEqual([1])
  })

  it('exits 0 when findings are warnings only', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--staged'],
      findings: [{ ...errorFinding, severity: 'warning' }]
    })
    expect(result.codes).toEqual([0])
  })

  it('exits 1 on warnings with --fail-on=warning', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--fail-on=warning'],
      findings: [{ ...errorFinding, severity: 'warning' }]
    })
    expect(result.codes).toEqual([1])
  })

  it('exits 0 on errors with --fail-on=never and reports non-blocking', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--fail-on=never'],
      findings: [errorFinding]
    })
    expect(result.codes).toEqual([0])
    const latest = join(dir, '.veto', 'runs', 'latest.json')
    expect(readFileSync(latest, 'utf8')).toContain('"blocking": false')
  })

  it('exits 2 on an invalid --fail-on value', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--fail-on=fatal']
    })
    expect(result.codes).toEqual([2])
  })

  it('accepts repeated --config flags instead of a directory', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: ['--config', join(dir, '.veto', 'architect.yaml')]
    })
    expect(result.codes).toEqual([0])
  })

  it('exits 2 outside a git repository', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'veto-cli-norepo-'))
    const result = await runCli({ cwd: dir, argv: [dir] })
    expect(result.codes).toEqual([2])
  })

  it('exits 2 when the config path does not exist', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, 'missing-configs')]
    })
    expect(result.codes).toEqual([2])
  })

  it('defaults to .veto/ on a bare veto --staged run', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({ cwd: dir, argv: ['--staged'] })
    expect(result.codes).toEqual([0])
    expect(existsSync(join(dir, '.veto', 'runs', 'latest.json'))).toBe(true)
  })

  it('exits 2 when no config is given and the repo has no .veto/', async () => {
    const dir = repoWithoutVeto()
    const result = await runCli({ cwd: dir, argv: ['--staged'] })
    expect(result.codes).toEqual([2])
  })

  it('exits 2 on an invalid flag value', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({
      cwd: dir,
      argv: [join(dir, '.veto'), '--format=xml']
    })
    expect(result.codes).toEqual([2])
  })

  it('serves --help without running a review', async () => {
    const dir = repoWithStagedChange()
    const result = await runCli({ cwd: dir, argv: ['--help'] })
    expect(result.codes).toEqual([])
    expect(Exit.isSuccess(result.exit)).toBe(true)
  })
})
