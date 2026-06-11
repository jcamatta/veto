import { describe, expect, it } from 'vitest'
import { appendHookLine } from '../../src/core/init-hook.js'

const hookCommand = 'npx veto .veto/ --staged'
const hookLine = `git rev-parse -q --verify MERGE_HEAD >/dev/null || ${hookCommand}`

describe('appendHookLine', () => {
  it('appends the hook line to an existing hook', () => {
    const result = appendHookLine('npm test\n')
    expect(result.changed).toBe(true)
    expect(result.text).toBe(`npm test\n${hookLine}\n`)
  })

  it('adds a newline before appending when the file lacks one', () => {
    const result = appendHookLine('npm test')
    expect(result.text).toBe(`npm test\n${hookLine}\n`)
  })

  it('appends to an empty hook without a leading blank line', () => {
    const result = appendHookLine('')
    expect(result.text).toBe(`${hookLine}\n`)
  })

  it('guards the appended line so merge commits skip the review', () => {
    const result = appendHookLine('npm test\n')
    expect(result.text).toContain('git rev-parse -q --verify MERGE_HEAD')
    expect(result.text).toContain(`|| ${hookCommand}`)
  })

  it('is idempotent when the line is already present', () => {
    const once = appendHookLine('npm test\n')
    const twice = appendHookLine(once.text)
    expect(twice.changed).toBe(false)
    expect(twice.text).toBe(once.text)
  })

  it('treats an unguarded legacy veto line as already wired', () => {
    const result = appendHookLine(`npm test\n${hookCommand}\n`)
    expect(result.changed).toBe(false)
  })
})
