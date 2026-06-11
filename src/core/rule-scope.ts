import type { ReviewerRule } from '../domain/reviewer-config.js'
import { buildFileMatcher } from './glob-matcher.js'
import { enabledRules } from './rules.js'

type RuleScopeInput = {
  readonly rule: ReviewerRule
  readonly file: string
}

type ActiveRulesInput = {
  readonly rules: readonly ReviewerRule[]
  readonly files: readonly string[]
}

const ruleAppliesTo = ({ rule, file }: RuleScopeInput): boolean =>
  typeof rule === 'string'
    ? true
    : buildFileMatcher({ paths: rule.paths, ignore: rule.ignore })(file)

const activeRules = ({
  rules,
  files
}: ActiveRulesInput): readonly ReviewerRule[] =>
  enabledRules(rules).filter((rule) =>
    files.some((file) => ruleAppliesTo({ rule, file }))
  )

export {
  type RuleScopeInput,
  type ActiveRulesInput,
  ruleAppliesTo,
  activeRules
}
