import type { ReviewerConfig } from '../domain/reviewer-config.js'
import type { StagedDiff } from '../domain/staged-diff.js'

type DiffBudgetInput = {
  readonly config: ReviewerConfig
  readonly diff: StagedDiff
}

const countLines = (text: string): number =>
  text === '' ? 0 : text.split('\n').length

const exceedsDiffBudget = ({ config, diff }: DiffBudgetInput): boolean => {
  const overLines =
    config.maxDiffLines !== undefined &&
    countLines(diff.diffText) > config.maxDiffLines
  const overFiles =
    config.maxDiffFiles !== undefined &&
    diff.files.length > config.maxDiffFiles
  return overLines || overFiles
}

export { exceedsDiffBudget }
