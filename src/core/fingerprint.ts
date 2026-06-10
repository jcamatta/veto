import { Schema } from 'effect'
import { Finding, Fingerprint, ModelFinding } from '../domain/finding.js'
import { type HashFn } from './hashing.js'

type FingerprintInput = {
  readonly hash: HashFn
  readonly reviewer: string
  readonly finding: ModelFinding
}

const decodeFingerprint = Schema.decodeSync(Fingerprint)

const stripLineNumbers = (line: string): string =>
  line.replace(/^\s*\d+[:.)]?\s+/, '')

const normalizeSnippet = (snippet: string): string =>
  snippet
    .split('\n')
    .map(stripLineNumbers)
    .join('\n')
    .replace(/\s+/g, '')

const fingerprintFinding = ({
  hash,
  reviewer,
  finding
}: FingerprintInput): Finding => {
  const preimage = [
    reviewer,
    finding.rule,
    finding.file,
    normalizeSnippet(finding.message)
  ].join('\u0000')
  const fingerprint = decodeFingerprint(hash(preimage).slice(0, 12))
  return { ...finding, fingerprint }
}

export { type FingerprintInput, normalizeSnippet, fingerprintFinding }
