import { describe, expect, it } from 'vitest'
import { Either, Schema } from 'effect'
import { Finding, Fingerprint, ModelFinding, ModelFindings } from '../../src/domain/finding.js'

const decodeFinding = Schema.decodeUnknownEither(Finding)
const decodeModelFinding = Schema.decodeUnknownEither(ModelFinding)
const decodeModelFindings = Schema.decodeUnknownEither(ModelFindings)
const decodeFingerprint = Schema.decodeUnknownEither(Fingerprint)

const validModel = {
  severity: 'error',
  file: 'src/api/users.ts',
  line: 42,
  rule: 'no cross-layer imports',
  message: 'UI component imports the repository directly.'
}

const valid = { ...validModel, fingerprint: 'a94f3c21e0b7' }

describe('Fingerprint', () => {
  it('accepts a short sha1 hex string', () => {
    expect(Either.isRight(decodeFingerprint('a94f3c21e0b7'))).toBe(true)
  })

  it('rejects non-hex content', () => {
    expect(Either.isLeft(decodeFingerprint('not-a-hash!'))).toBe(true)
  })

  it('rejects strings longer than a full sha1', () => {
    expect(Either.isLeft(decodeFingerprint('a'.repeat(41)))).toBe(true)
  })
})

describe('ModelFinding', () => {
  it('decodes a valid model finding without fingerprint', () => {
    expect(Either.isRight(decodeModelFinding(validModel))).toBe(true)
  })

  it('accepts a null line', () => {
    expect(Either.isRight(decodeModelFinding({ ...validModel, line: null }))).toBe(true)
  })

  it('accepts an optional suggestion', () => {
    const result = decodeModelFinding({ ...validModel, suggestion: 'Route through the service layer.' })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects an unknown severity', () => {
    expect(Either.isLeft(decodeModelFinding({ ...validModel, severity: 'fatal' }))).toBe(true)
  })

  it('rejects a non-integer line', () => {
    expect(Either.isLeft(decodeModelFinding({ ...validModel, line: 4.2 }))).toBe(true)
  })

  it('rejects a zero or negative line', () => {
    expect(Either.isLeft(decodeModelFinding({ ...validModel, line: 0 }))).toBe(true)
  })
})

describe('ModelFindings', () => {
  it('decodes a findings envelope', () => {
    expect(Either.isRight(decodeModelFindings({ findings: [validModel] }))).toBe(true)
  })

  it('rejects a missing findings array', () => {
    expect(Either.isLeft(decodeModelFindings({}))).toBe(true)
  })
})

describe('Finding', () => {
  it('decodes a fingerprinted finding', () => {
    expect(Either.isRight(decodeFinding(valid))).toBe(true)
  })

  it('rejects a finding without fingerprint', () => {
    expect(Either.isLeft(decodeFinding(validModel))).toBe(true)
  })
})
