import { Schema } from 'effect'

const FailOn = Schema.Literal('error', 'warning', 'info', 'never')

type FailOn = typeof FailOn.Type

const defaultFailOn: FailOn = 'error'

export { FailOn, defaultFailOn }
