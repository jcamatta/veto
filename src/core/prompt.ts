import { Baseline } from '../domain/baseline.js'
import {
  ReviewerConfig,
  type ReviewerRule
} from '../domain/reviewer-config.js'
import { StagedDiff } from '../domain/staged-diff.js'

type PromptInput = {
  readonly config: ReviewerConfig
  readonly diff: StagedDiff
  readonly baseline: Baseline | null
}

const layer2Instructions = [
  'A previous review attempt produced the findings above. For this run:',
  '1. For each previous finding, state whether it is now resolved.',
  '2. Report genuinely new problems introduced by the modifications.',
  '3. Do not raise new objections to code you previously reviewed and did',
  '   not flag. No flip-flopping on previously accepted code.'
].join('\n')

const jsonInstruction = [
  'End your response with a single JSON object and nothing after it,',
  'matching exactly this shape:',
  '{"findings": [{"severity": "error" | "warning" | "info",',
  '"file": "<repo-relative path>", "line": <number or null>,',
  '"rule": "<the bracketed id of the rule that triggered this, or the rule text when it has no id>",',
  '"message": "<what is wrong>", "suggestion": "<optional fix>"}]}',
  'If there is nothing to report, end with {"findings": []}.'
].join('\n')

const ruleLine = (rule: ReviewerRule): string =>
  typeof rule === 'string' ? `- ${rule}` : `- [${rule.id}] ${rule.rule}`

const rulesSection = (config: ReviewerConfig): string =>
  ['## Rules', ...config.rules.map(ruleLine)].join('\n')

const filesSection = (diff: StagedDiff): string =>
  ['## Staged files in your scope', ...diff.files.map((f) => `- ${f}`)].join(
    '\n'
  )

const diffSection = (diff: StagedDiff): string =>
  ['## Staged diff', '```diff', diff.diffText, '```'].join('\n')

const baselineSection = (baseline: Baseline | null): string | null =>
  baseline === null
    ? null
    : [
        '## Previous findings (attempt ' + String(baseline.attempt) + ')',
        '```json',
        JSON.stringify(baseline.findings, null, 2),
        '```',
        layer2Instructions
      ].join('\n')

type RetryInput = {
  readonly prompt: string
  readonly message: string
}

const appendParseRetry = ({ prompt, message }: RetryInput): string =>
  [
    prompt,
    `Your previous output failed validation: ${message}`,
    'Emit only a single valid JSON object matching the required shape,',
    'with nothing before or after it.'
  ].join('\n\n')

const buildPrompt = ({ config, diff, baseline }: PromptInput): string =>
  [
    config.systemPrompt,
    rulesSection(config),
    filesSection(diff),
    diffSection(diff),
    baselineSection(baseline),
    jsonInstruction
  ]
    .filter((section): section is string => section !== null)
    .join('\n\n')

export { type PromptInput, type RetryInput, buildPrompt, appendParseRetry }
