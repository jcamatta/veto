import { describe, expect, it } from 'vitest'
import { appendHookLine } from '../../src/core/init-hook.js'

const hookLine = 'npx veto .veto/ --staged'

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

  it('is idempotent when the line is already present', () => {
    const once = appendHookLine('npm test\n')
    const twice = appendHookLine(once.text)
    expect(twice.changed).toBe(false)
    expect(twice.text).toBe(once.text)
  })
})
