import { JSONSchema } from 'effect'
import { ReviewerConfig } from '../domain/reviewer-config.js'

const configJsonSchema: JSONSchema.JsonSchema7Root =
  JSONSchema.make(ReviewerConfig)

const configJsonSchemaText = JSON.stringify(configJsonSchema, null, 2)

export { configJsonSchema, configJsonSchemaText }
