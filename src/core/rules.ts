import type { ReviewerRule } from '../domain/reviewer-config.js'

const ruleKey = (rule: ReviewerRule): string =>
  typeof rule === 'string' ? rule : rule.id

const ruleText = (rule: ReviewerRule): string =>
  typeof rule === 'string' ? rule : rule.instruction

const ruleKeys = (rules: readonly ReviewerRule[]): readonly string[] =>
  rules.map(ruleKey)

export { ruleKey, ruleText, ruleKeys }
