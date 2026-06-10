import { describe, expect, it } from 'vitest'
import { configHash, diffHash, replayKey } from '../../src/core/hashing.js'
import { fakeHash } from './fake-hash.js'

describe('hashing', () => {
  it('diffHash hashes the diff text', () => {
    expect(diffHash({ hash: fakeHash, diffText: 'abc' })).toBe(fakeHash('abc'))
  })

  it('configHash hashes the config text', () => {
    expect(configHash({ hash: fakeHash, configText: 'name: x' })).toBe(
      fakeHash('name: x')
    )
  })

  it('replayKey is stable for identical inputs', () => {
    const a = replayKey({ hash: fakeHash, diffText: 'd', configText: 'c' })
    const b = replayKey({ hash: fakeHash, diffText: 'd', configText: 'c' })
    expect(a).toBe(b)
  })

  it('replayKey changes when the diff changes', () => {
    const a = replayKey({ hash: fakeHash, diffText: 'd1', configText: 'c' })
    const b = replayKey({ hash: fakeHash, diffText: 'd2', configText: 'c' })
    expect(a).not.toBe(b)
  })

  it('replayKey changes when the config changes', () => {
    const a = replayKey({ hash: fakeHash, diffText: 'd', configText: 'c1' })
    const b = replayKey({ hash: fakeHash, diffText: 'd', configText: 'c2' })
    expect(a).not.toBe(b)
  })
})
