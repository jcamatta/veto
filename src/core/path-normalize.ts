type ResolveInput = {
  readonly root: string
  readonly path: string
}

type CollapseStep = {
  readonly acc: readonly string[]
  readonly segment: string
}

const pushSegment = ({ acc, segment }: CollapseStep): readonly string[] => {
  if (segment === '' || segment === '.') {
    return acc
  }
  if (segment === '..') {
    return acc.length > 0 && acc[acc.length - 1] !== '..'
      ? acc.slice(0, -1)
      : [...acc, segment]
  }
  return [...acc, segment]
}

const collapseSegments = (segments: readonly string[]): readonly string[] => {
  if (segments.length === 0) {
    return []
  }
  const acc = collapseSegments(segments.slice(0, -1))
  return pushSegment({ acc, segment: segments[segments.length - 1] ?? '' })
}

const splitPrefix = (unified: string): readonly [string, string] => {
  const drive = /^[A-Za-z]:/.exec(unified)
  if (drive !== null) {
    return [unified.slice(0, 2).toLowerCase(), unified.slice(2)]
  }
  return unified.startsWith('/') ? ['', unified] : ['.', unified]
}

const normalizePath = (raw: string): string => {
  const unified = raw.replace(/\\/g, '/')
  const [prefix, body] = splitPrefix(unified)
  const collapsed = collapseSegments(body.split('/')).join('/')
  if (prefix === '.') {
    return collapsed
  }
  return `${prefix}/${collapsed}`
}

const isAbsolutePath = (raw: string): boolean =>
  raw.startsWith('/') || raw.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(raw)

const resolveWithin = ({ root, path }: ResolveInput): string =>
  isAbsolutePath(path)
    ? normalizePath(path)
    : normalizePath(`${root}/${path}`)

export { type ResolveInput, normalizePath, isAbsolutePath, resolveWithin }
