import { Array as Arr, Order } from 'effect'
import type { Finding, Severity } from '../domain/finding.js'
import type { RuleStats, SeverityCounts } from '../domain/rule-stats.js'
import type { StoredEvent } from '../domain/stored-event.js'

type Acc = {
  readonly stats: ReadonlyMap<string, RuleStats>
  readonly ruleOfFingerprint: ReadonlyMap<string, string>
}

type FiredFinding = {
  readonly head: string
  readonly finding: Finding
}

const emptyAcc: Acc = { stats: new Map(), ruleOfFingerprint: new Map() }

const emptySeverities: SeverityCounts = { error: 0, warning: 0, info: 0 }

const bumpSeverity =
  (counts: SeverityCounts) =>
  (severity: Severity): SeverityCounts => ({
    ...counts,
    [severity]: counts[severity] + 1
  })

const firedStats =
  (previous: RuleStats | undefined) =>
  ({ head, finding }: FiredFinding): RuleStats => ({
    rule: finding.rule,
    fired: (previous?.fired ?? 0) + 1,
    suppressed: previous?.suppressed ?? 0,
    severities: bumpSeverity(previous?.severities ?? emptySeverities)(
      finding.severity
    ),
    lastHead: head
  })

const applyFinding =
  (acc: Acc) =>
  (fired: FiredFinding): Acc => {
    const rule = fired.finding.rule
    const next = firedStats(acc.stats.get(rule))(fired)
    return {
      stats: new Map([...acc.stats, [rule, next]]),
      ruleOfFingerprint: new Map([
        ...acc.ruleOfFingerprint,
        [fired.finding.fingerprint, rule]
      ])
    }
  }

const applySuppression =
  (acc: Acc) =>
  (fingerprint: string): Acc => {
    const rule = acc.ruleOfFingerprint.get(fingerprint)
    const previous = rule === undefined ? undefined : acc.stats.get(rule)
    return rule === undefined || previous === undefined
      ? acc
      : {
          ...acc,
          stats: new Map([
            ...acc.stats,
            [rule, { ...previous, suppressed: previous.suppressed + 1 }]
          ])
        }
  }

const applyFindings = (input: {
  readonly acc: Acc
  readonly fired: readonly FiredFinding[]
}): Acc => {
  const [head, ...rest] = input.fired
  return head === undefined
    ? input.acc
    : applyFindings({ acc: applyFinding(input.acc)(head), fired: rest })
}

const applyEvent =
  (acc: Acc) =>
  (stored: StoredEvent): Acc => {
    if (stored.event._tag === 'FindingsDecoded') {
      const fired = stored.event.findings.map((finding) => ({
        head: stored.head,
        finding
      }))
      return applyFindings({ acc, fired })
    }
    return stored.event._tag === 'FindingSuppressed'
      ? applySuppression(acc)(stored.event.fingerprint)
      : acc
  }

const foldEvents = (input: {
  readonly acc: Acc
  readonly events: readonly StoredEvent[]
}): Acc => {
  const [head, ...rest] = input.events
  return head === undefined
    ? input.acc
    : foldEvents({ acc: applyEvent(input.acc)(head), events: rest })
}

const byFiredThenRule: Order.Order<RuleStats> = Order.combine(
  Order.mapInput(Order.reverse(Order.number), (stats: RuleStats) => stats.fired),
  Order.mapInput(Order.string, (stats: RuleStats) => stats.rule)
)

const foldRuleStats = (
  events: readonly StoredEvent[]
): readonly RuleStats[] => {
  const folded = foldEvents({ acc: emptyAcc, events })
  return Arr.sort([...folded.stats.values()], byFiredThenRule)
}

export { foldRuleStats }
