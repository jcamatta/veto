import picomatch from 'picomatch'
import { ReviewerConfig } from '../domain/reviewer-config.js'

type MatcherInput = {
  readonly paths?: readonly string[] | undefined
  readonly ignore?: readonly string[] | undefined
}

type FileMatcher = (file: string) => boolean

type ScopeInput = {
  readonly config: ReviewerConfig
  readonly files: readonly string[]
}

type Scope = {
  readonly inScope: readonly string[]
  readonly matched: boolean
}

const alwaysMatches = (): boolean => true

const neverMatches = (): boolean => false

const buildFileMatcher = ({ paths, ignore }: MatcherInput): FileMatcher => {
  const matchesPaths =
    paths === undefined ? alwaysMatches : picomatch([...paths], { dot: true })
  const matchesIgnore =
    ignore === undefined || ignore.length === 0
      ? neverMatches
      : picomatch([...ignore], { dot: true })
  return (file) => matchesPaths(file) && !matchesIgnore(file)
}

const scopeFiles = ({ config, files }: ScopeInput): Scope => {
  const matches = buildFileMatcher({
    paths: config.paths,
    ignore: config.ignore
  })
  const inScope = files.filter(matches)
  return { inScope, matched: inScope.length > 0 }
}

export {
  type MatcherInput,
  type FileMatcher,
  type ScopeInput,
  type Scope,
  buildFileMatcher,
  scopeFiles
}
