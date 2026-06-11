import { exceedsDiffBudget } from '../core/diff-budget.js'
import { scopeDiff } from '../core/diff-scope.js'
import { activeRules } from '../core/rule-scope.js'
import type { ReviewerRule } from '../domain/reviewer-config.js'
import type { StagedDiff } from '../domain/staged-diff.js'
import type { ReviewerSource } from './inputs.js'

type SkipReason = 'no-matching-paths' | 'no-active-rules' | 'diff-too-large'

type GateInput = {
  readonly reviewer: ReviewerSource
  readonly diff: StagedDiff
}

type GateResult =
  | { readonly _tag: 'Skip'; readonly reason: SkipReason }
  | {
      readonly _tag: 'Proceed'
      readonly diff: StagedDiff
      readonly rules: readonly ReviewerRule[]
    }

const gateReviewer = ({ reviewer, diff }: GateInput): GateResult => {
  const scoped = scopeDiff({ config: reviewer.config, diff })
  if (scoped.files.length === 0) {
    return { _tag: 'Skip', reason: 'no-matching-paths' }
  }
  if (exceedsDiffBudget({ config: reviewer.config, diff: scoped })) {
    return { _tag: 'Skip', reason: 'diff-too-large' }
  }
  const rules = activeRules({
    rules: reviewer.config.rules,
    files: scoped.files
  })
  return rules.length === 0
    ? { _tag: 'Skip', reason: 'no-active-rules' }
    : { _tag: 'Proceed', diff: scoped, rules }
}

export { gateReviewer, type GateResult, type SkipReason }
