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

const structuredRetriesExhausted = (raws: readonly unknown[]): boolean =>
  lastEnvelope(raws)?.subtype === 'error_max_structured_output_retries'

export {
  type ResultMessage,
  resultText,
  structuredOutput,
  structuredRetriesExhausted
}
