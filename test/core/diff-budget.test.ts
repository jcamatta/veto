import { describe, expect, it } from 'vitest'
import { exceedsDiffBudget } from '../../src/core/diff-budget.js'
import type { ReviewerConfig } from '../../src/domain/reviewer-config.js'
import type { StagedDiff } from '../../src/domain/staged-diff.js'

const config = (overrides: Partial<ReviewerConfig>): ReviewerConfig => ({
  name: 'architect',
  mode: 'static',
  paths: ['src/**/*.ts'],
  ignore: [],
  systemPrompt: 'review',
  rules: ['r'],
  ...overrides
})

const diffOf = (lines: number, files: number): StagedDiff => ({
  diffText: Array.from({ length: lines }, (_, i) => `+line ${String(i)}`).join(
    '\n'
  ),
  files: Array.from({ length: files }, (_, i) => `src/f${String(i)}.ts`)
})

describe('exceedsDiffBudget', () => {
  it('is false when no budget is configured', () => {
    expect(
      exceedsDiffBudget({ config: config({}), diff: diffOf(5000, 100) })
    ).toBe(false)
  })

  it('is false when the diff is within both budgets', () => {
    expect(
      exceedsDiffBudget({
        config: config({ maxDiffLines: 10, maxDiffFiles: 3 }),
        diff: diffOf(10, 3)
      })
    ).toBe(false)
  })

  it('is true when the diff exceeds the line budget', () => {
    expect(
      exceedsDiffBudget({
        config: config({ maxDiffLines: 9 }),
        diff: diffOf(10, 1)
      })
    ).toBe(true)
  })

  it('is true when the diff exceeds the file budget', () => {
    expect(
      exceedsDiffBudget({
        config: config({ maxDiffFiles: 2 }),
        diff: diffOf(3, 3)
      })
    ).toBe(true)
  })

  it('treats an empty diff as zero lines', () => {
    expect(
      exceedsDiffBudget({
        config: config({ maxDiffLines: 1 }),
        diff: { diffText: '', files: ['src/a.ts'] }
      })
    ).toBe(false)
  })
})
