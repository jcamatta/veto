import { JSONSchema } from 'effect'
import { ReviewerConfig } from '../domain/reviewer-config.js'

const configJsonSchema: JSONSchema.JsonSchema7Root =
  JSONSchema.make(ReviewerConfig)

export { configJsonSchema }
