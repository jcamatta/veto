import picomatch from 'picomatch'
import { ReviewerConfig } from '../domain/reviewer-config.js'

type ScopeInput = {
  readonly config: ReviewerConfig
  readonly files: readonly string[]
}

type Scope = {
  readonly inScope: readonly string[]
  readonly matched: boolean
}

const neverMatches = (): boolean => false

const scopeFiles = ({ config, files }: ScopeInput): Scope => {
  const matchesPaths = picomatch([...config.paths], { dot: true })
  const matchesIgnore =
    config.ignore.length > 0
      ? picomatch([...config.ignore], { dot: true })
      : neverMatches
  const inScope = files.filter(
    (file) => matchesPaths(file) && !matchesIgnore(file)
  )
  return { inScope, matched: inScope.length > 0 }
}

export { type ScopeInput, type Scope, scopeFiles }
