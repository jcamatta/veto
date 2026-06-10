import { Either, Schema } from 'effect'
import {
  findingsParseError,
  type FindingsParseError
} from '../domain/errors.js'
import { ModelFindings } from '../domain/finding.js'
import { type Result, err, ok } from './result.js'

type Candidates = {
  readonly text: string
  readonly indices: readonly number[]
}

const decodeFindings = Schema.decodeUnknownEither(
  Schema.parseJson(ModelFindings)
)

const decodeStructured = Schema.decodeUnknownEither(ModelFindings)

const structuredFindings = (
  value: unknown
): Result<ModelFindings, FindingsParseError> => {
  const attempt = decodeStructured(value)
  return Either.isRight(attempt)
    ? ok(attempt.right)
    : err(findingsParseError(attempt.left.message))
}

const stripTrailingFence = (text: string): string =>
  text.trimEnd().replace(/```$/, '')

const indicesFrom = (input: {
  readonly text: string
  readonly from: number
}): readonly number[] => {
  const index = input.text.indexOf('{', input.from)
  return index === -1
    ? []
    : [index, ...indicesFrom({ text: input.text, from: index + 1 })]
}

const braceIndices = (text: string): readonly number[] =>
  indicesFrom({ text, from: 0 })

const firstDecodable = ({ text, indices }: Candidates): ModelFindings | null => {
  const [head, ...rest] = indices
  if (head === undefined) {
    return null
  }
  const attempt = decodeFindings(text.slice(head))
  return Either.isRight(attempt)
    ? attempt.right
    : firstDecodable({ text, indices: rest })
}

const describeFailure = ({ text, indices }: Candidates): string => {
  const [head] = indices
  if (head === undefined) {
    return 'no JSON object found in agent output'
  }
  const attempt = decodeFindings(text.slice(head))
  return Either.isLeft(attempt)
    ? attempt.left.message
    : 'no JSON object matching the findings shape found in agent output'
}

const parseFindings = (
  text: string | null
): Result<ModelFindings, FindingsParseError> => {
  if (text === null) {
    return err(findingsParseError('agent produced no result text'))
  }
  const cleaned = stripTrailingFence(text)
  const candidates = { text: cleaned, indices: braceIndices(cleaned) }
  const found = firstDecodable(candidates)
  return found === null
    ? err(findingsParseError(describeFailure(candidates)))
    : ok(found)
}

export { parseFindings, structuredFindings }
