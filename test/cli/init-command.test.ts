import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Ref } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { makeCli, type CliExitCode } from '../../src/cli/command.js'

const hookLine = 'npx veto .veto/ --staged'

const git = (cwd: string, args: readonly string[]): void => {
  execFileSync('git', [...args], { cwd, stdio: 'pipe' })
}

const emptyRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'veto-init-'))
  git(dir, ['init', '-b', 'main'])
  return dir
}

const runInitCli = async (cwd: string): Promise<readonly CliExitCode[]> => {
  const codes = await Effect.runPromise(Ref.make<readonly CliExitCode[]>([]))
  const cli = makeCli({
    exit: (code) =>
      Ref.update(codes, (recorded) => [...recorded, code]).pipe(
        Effect.zipRight(Effect.interrupt)
      ),
    cwd
  })
  await Effect.runPromiseExit(
    cli(['node', 'veto', 'init']).pipe(Effect.provide(NodeContext.layer))
  )
  return Effect.runPromise(Ref.get(codes))
}

describe('veto init', () => {
  it('scaffolds a starter config in a bare repo and exits 0', async () => {
    const dir = emptyRepo()
    const codes = await runInitCli(dir)
    expect(codes).toEqual([0])
    const starter = join(dir, '.veto', 'architect.yaml')
    expect(existsSync(starter)).toBe(true)
    expect(readFileSync(starter, 'utf8')).toContain('name: architect')
  })

  it('shapes the starter to the stack detected from package.json', async () => {
    const dir = emptyRepo()
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { electron: '^31.0.0' } })
    )
    await runInitCli(dir)
    const starter = readFileSync(join(dir, '.veto', 'architect.yaml'), 'utf8')
    expect(starter).toContain('electron/**/*.ts')
    expect(starter).toContain('ipc-validation')
  })

  it('appends the veto line to an existing husky pre-commit hook', async () => {
    const dir = emptyRepo()
    mkdirSync(join(dir, '.husky'))
    writeFileSync(join(dir, '.husky', 'pre-commit'), 'npm test\n')
    const codes = await runInitCli(dir)
    expect(codes).toEqual([0])
    expect(readFileSync(join(dir, '.husky', 'pre-commit'), 'utf8')).toBe(
      `npm test\n${hookLine}\n`
    )
  })

  it('leaves an already-wired hook untouched', async () => {
    const dir = emptyRepo()
    mkdirSync(join(dir, '.husky'))
    const wired = `npm test\n${hookLine}\n`
    writeFileSync(join(dir, '.husky', 'pre-commit'), wired)
    const codes = await runInitCli(dir)
    expect(codes).toEqual([0])
    expect(readFileSync(join(dir, '.husky', 'pre-commit'), 'utf8')).toBe(wired)
  })

  it('refuses to clobber existing reviewer configs and exits 2', async () => {
    const dir = emptyRepo()
    mkdirSync(join(dir, '.veto'))
    writeFileSync(join(dir, '.veto', 'mine.yaml'), 'name: mine\n')
    const codes = await runInitCli(dir)
    expect(codes).toEqual([2])
    expect(existsSync(join(dir, '.veto', 'architect.yaml'))).toBe(false)
  })

  it('exits 2 outside a git repository', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'veto-init-norepo-'))
    const codes = await runInitCli(dir)
    expect(codes).toEqual([2])
    expect(existsSync(join(dir, '.veto'))).toBe(false)
  })
})
