import type { ReviewerConfig } from '../domain/reviewer-config.js'
import type { StagedDiff } from '../domain/staged-diff.js'
import { scopeFiles } from './glob-scope.js'

type ScopeDiffInput = {
  readonly config: ReviewerConfig
  readonly diff: StagedDiff
}

type Segment = {
  readonly file: string | null
  readonly text: string
}

const headerPattern = /^diff --git a\/.+ b\/(.+)$/

const headerFile = (line: string): string | null =>
  headerPattern.exec(line)?.[1] ?? null

const segmentAt =
  (lines: readonly string[]) =>
  ({ start, end }: { readonly start: number; readonly end: number }): Segment => ({
    file: headerFile(lines[start] ?? ''),
    text: lines.slice(start, end).join('\n')
  })

const splitSegments = (diffText: string): readonly Segment[] => {
  const lines = diffText.split('\n')
  const starts = [...lines.keys()].filter((index) =>
    (lines[index] ?? '').startsWith('diff --git ')
  )
  const first = starts[0]
  if (first === undefined) {
    return [{ file: null, text: diffText }]
  }
  const preamble: readonly Segment[] =
    first > 0 ? [{ file: null, text: lines.slice(0, first).join('\n') }] : []
  const segments = [...starts.keys()].map((index) =>
    segmentAt(lines)({
      start: starts[index] ?? 0,
      end: starts[index + 1] ?? lines.length
    })
  )
  return [...preamble, ...segments]
}

const scopeDiff = ({ config, diff }: ScopeDiffInput): StagedDiff => {
  const { inScope } = scopeFiles({ config, files: diff.files })
  const allowed: ReadonlySet<string> = new Set(inScope)
  const kept = splitSegments(diff.diffText).filter(
    (segment) => segment.file === null || allowed.has(segment.file)
  )
  return { diffText: kept.map((segment) => segment.text).join('\n'), files: inScope }
}

export { type ScopeDiffInput, scopeDiff }
