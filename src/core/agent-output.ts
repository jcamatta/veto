import { Option, Schema } from 'effect'

type ResultMessage = {
  readonly type: 'result'
  readonly result: string
}

const ResultEnvelope = Schema.Struct({
  type: Schema.Literal('result'),
  subtype: Schema.optional(Schema.String),
  structured_output: Schema.optional(Schema.Unknown)
})

const decodeEnvelope = Schema.decodeUnknownOption(ResultEnvelope)

const lastEnvelope = (raws: readonly unknown[]) =>
  raws
    .flatMap((raw) =>
      Option.match(decodeEnvelope(raw), {
        onNone: () => [],
        onSome: (envelope) => [envelope]
      })
    )
    .at(-1)

const hasResultShape = (raw: object): boolean =>
  'type' in raw &&
  raw.type === 'result' &&
  'result' in raw &&
  typeof raw.result === 'string'

const isResultMessage = (raw: unknown): raw is ResultMessage =>
  typeof raw === 'object' && raw !== null && hasResultShape(raw)

const resultText = (raws: readonly unknown[]): string | null => {
  const found = [...raws].reverse().find(isResultMessage)
  return found === undefined ? null : found.result
}

const structuredOutput = (raws: readonly unknown[]): unknown =>
  lastEnvelope(raws)?.structured_output

const terminalFailureMessage = (raws: readonly unknown[]): string | null => {
  const subtype = lastEnvelope(raws)?.subtype
  return subtype === 'error_max_budget_usd'
    ? 'cost ceiling reached before the review finished (maxCostUsd)'
    : subtype === 'error_max_structured_output_retries'
      ? 'structured output failed validation after model retries'
      : null
}

export {
  type ResultMessage,
  resultText,
  structuredOutput,
  terminalFailureMessage
}
