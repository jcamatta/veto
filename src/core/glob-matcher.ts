import picomatch from 'picomatch'

type MatcherInput = {
  readonly paths?: readonly string[] | undefined
  readonly ignore?: readonly string[] | undefined
}

type FileMatcher = (file: string) => boolean

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

export { type MatcherInput, type FileMatcher, buildFileMatcher }
