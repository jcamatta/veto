import type { RuleStats } from '../domain/rule-stats.js'

type RenderInput = {
  readonly rules: readonly RuleStats[]
  readonly retainedHeads: number
}

type Column = {
  readonly header: string
  readonly numeric: boolean
  readonly cell: (stats: RuleStats) => string
}

type SizedColumn = Column & { readonly width: number }

const shortHead = (head: string): string => head.slice(0, 7)

const columns: readonly Column[] = [
  { header: 'rule', numeric: false, cell: (s) => s.rule },
  { header: 'fired', numeric: true, cell: (s) => String(s.fired) },
  { header: 'suppressed', numeric: true, cell: (s) => String(s.suppressed) },
  { header: 'error', numeric: true, cell: (s) => String(s.severities.error) },
  {
    header: 'warning',
    numeric: true,
    cell: (s) => String(s.severities.warning)
  },
  { header: 'info', numeric: true, cell: (s) => String(s.severities.info) },
  { header: 'last seen', numeric: false, cell: (s) => shortHead(s.lastHead) }
]

const sized =
  (rules: readonly RuleStats[]) =>
  (column: Column): SizedColumn => ({
    ...column,
    width: Math.max(
      column.header.length,
      ...rules.map((stats) => column.cell(stats).length)
    )
  })

const pad =
  (column: SizedColumn) =>
  (text: string): string =>
    column.numeric ? text.padStart(column.width) : text.padEnd(column.width)

const lineOf = (cells: readonly string[]): string =>
  cells.join('  ').trimEnd()

const windowNote = (retainedHeads: number): string =>
  `window: last ${String(retainedHeads)} heads of run history (older runs are pruned)`

const renderRuleStats = (input: RenderInput): string => {
  const note = windowNote(input.retainedHeads)
  if (input.rules.length === 0) {
    return `no findings recorded yet — ${note}\n`
  }
  const table = columns.map(sized(input.rules))
  const header = lineOf(table.map((column) => pad(column)(column.header)))
  const rows = input.rules.map((stats) =>
    lineOf(table.map((column) => pad(column)(column.cell(stats))))
  )
  return [header, ...rows, '', note].join('\n').concat('\n')
}

export { renderRuleStats }
