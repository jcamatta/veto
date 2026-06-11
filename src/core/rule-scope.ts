import type { Finding } from '../domain/finding.js'
import type { ReviewerRule } from '../domain/reviewer-config.js'
import { buildFileMatcher } from './glob-matcher.js'
import { enabledRules, ruleKey } from './rules.js'

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

type FindingScopeInput = {
  readonly rules: readonly ReviewerRule[]
  readonly findings: readonly Finding[]
}

type FindingScopePartition = {
  readonly applicable: readonly Finding[]
  readonly outOfScope: readonly Finding[]
}

const partitionByRuleScope = ({
  rules,
  findings
}: FindingScopeInput): FindingScopePartition => {
  const applies = (finding: Finding): boolean =>
    rules.some(
      (rule) =>
        ruleKey(rule) === finding.rule &&
        ruleAppliesTo({ rule, file: finding.file })
    )
  return {
    applicable: findings.filter(applies),
    outOfScope: findings.filter((finding) => !applies(finding))
  }
}

export {
  type RuleScopeInput,
  type ActiveRulesInput,
  type FindingScopeInput,
  type FindingScopePartition,
  ruleAppliesTo,
  activeRules,
  partitionByRuleScope
}
