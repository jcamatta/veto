type ResultMessage = {
  readonly type: 'result'
  readonly result: string
}

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

export { type ResultMessage, resultText }
