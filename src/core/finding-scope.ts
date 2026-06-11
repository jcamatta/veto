import type { Finding } from '../domain/finding.js'
import type { ReviewerRule } from '../domain/reviewer-config.js'
import { ruleAppliesTo } from './rule-scope.js'
import { ruleKey } from './rules.js'

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
  type FindingScopeInput,
  type FindingScopePartition,
  partitionByRuleScope
}
