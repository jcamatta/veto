import type { ReviewerRule } from '../domain/reviewer-config.js'

const ruleKey = (rule: ReviewerRule): string =>
  typeof rule === 'string' ? rule : rule.id

const ruleText = (rule: ReviewerRule): string =>
  typeof rule === 'string' ? rule : rule.instruction

const ruleKeys = (rules: readonly ReviewerRule[]): readonly string[] =>
  rules.map(ruleKey)

const ruleEnabled = (rule: ReviewerRule): boolean =>
  typeof rule === 'string' || rule.enabled !== false

const enabledRules = (
  rules: readonly ReviewerRule[]
): readonly ReviewerRule[] => rules.filter(ruleEnabled)

export { ruleKey, ruleText, ruleKeys, ruleEnabled, enabledRules }
