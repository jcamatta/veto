import type { ReviewerRule } from '../domain/reviewer-config.js'
import { buildFileMatcher } from './glob-scope.js'

type RuleScopeInput = {
  readonly rule: ReviewerRule
  readonly file: string
}

const ruleAppliesTo = ({ rule, file }: RuleScopeInput): boolean =>
  typeof rule === 'string'
    ? true
    : buildFileMatcher({ paths: rule.paths, ignore: rule.ignore })(file)

export { type RuleScopeInput, ruleAppliesTo }
