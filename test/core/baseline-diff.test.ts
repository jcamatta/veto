import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { diffBaseline } from '../../src/core/baseline-diff.js'
import { Finding, Fingerprint } from '../../src/domain/finding.js'

const fp = Schema.decodeSync(Fingerprint)

const finding = (fingerprint: string): Finding => ({
  severity: 'error',
  file: 'src/a.ts',
  line: 1,
  rule: 'r',
  message: 'm',
  fingerprint: fp(fingerprint)
})

const resolvedOne = finding('aaaaaaaaaaaa')
const persistingOne = finding('bbbbbbbbbbbb')
const freshOne = finding('cccccccccccc')

describe('diffBaseline', () => {
  it('splits findings into resolved, persisting, and fresh', () => {
    const result = diffBaseline({
      baseline: { attempt: 1, findings: [resolvedOne, persistingOne] },
      current: [persistingOne, freshOne]
    })
    expect(result.resolved).toEqual(['aaaaaaaaaaaa'])
    expect(result.persisting).toEqual([persistingOne])
    expect(result.fresh).toEqual([freshOne])
  })

  it('treats everything as fresh without a baseline', () => {
    const result = diffBaseline({ baseline: null, current: [freshOne] })
    expect(result.resolved).toEqual([])
    expect(result.persisting).toEqual([])
    expect(result.fresh).toEqual([freshOne])
  })

  it('resolves everything when the current run is clean', () => {
    const result = diffBaseline({
      baseline: { attempt: 2, findings: [resolvedOne] },
      current: []
    })
    expect(result.resolved).toEqual(['aaaaaaaaaaaa'])
    expect(result.persisting).toEqual([])
    expect(result.fresh).toEqual([])
  })
})
