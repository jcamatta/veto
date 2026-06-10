import { describe, expect, it } from 'vitest'
import { detectStack } from '../../src/core/init-detect.js'

const manifest = (deps: Record<string, Record<string, string>>): string =>
  JSON.stringify(deps)

describe('detectStack', () => {
  it('detects electron from dependencies', () => {
    expect(
      detectStack(manifest({ devDependencies: { electron: '^31.0.0' } }))
    ).toBe('electron')
  })

  it('prefers electron over react when both are present', () => {
    expect(
      detectStack(
        manifest({
          dependencies: { react: '^18.0.0' },
          devDependencies: { electron: '^31.0.0' }
        })
      )
    ).toBe('electron')
  })

  it('detects next before react', () => {
    expect(
      detectStack(
        manifest({ dependencies: { next: '^15.0.0', react: '^18.0.0' } })
      )
    ).toBe('next')
  })

  it('detects react from dependencies', () => {
    expect(detectStack(manifest({ dependencies: { react: '^18.0.0' } }))).toBe(
      'react'
    )
  })

  it('falls back to node for a plain library', () => {
    expect(
      detectStack(manifest({ dependencies: { effect: '^3.0.0' } }))
    ).toBe('node')
  })

  it('falls back to node when the manifest is missing', () => {
    expect(detectStack(null)).toBe('node')
  })

  it('falls back to node on malformed json', () => {
    expect(detectStack('{ not json')).toBe('node')
  })

  it('falls back to node when dependency maps are absent', () => {
    expect(detectStack('{"name":"lib"}')).toBe('node')
  })
})
