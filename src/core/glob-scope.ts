import { ReviewerConfig } from '../domain/reviewer-config.js'
import { buildFileMatcher } from './glob-matcher.js'

type ScopeInput = {
  readonly config: ReviewerConfig
  readonly files: readonly string[]
}

type Scope = {
  readonly inScope: readonly string[]
  readonly matched: boolean
}

const scopeFiles = ({ config, files }: ScopeInput): Scope => {
  const matches = buildFileMatcher({
    paths: config.paths,
    ignore: config.ignore
  })
  const inScope = files.filter(matches)
  return { inScope, matched: inScope.length > 0 }
}

export { type ScopeInput, type Scope, scopeFiles }
