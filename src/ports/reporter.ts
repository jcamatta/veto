import { Context, Effect } from 'effect'
import type { LatestProjection } from '../domain/latest-projection.js'

type ReportFormat = 'pretty' | 'json'

type EmitInput = {
  readonly projection: LatestProjection
  readonly format: ReportFormat
}

type ReporterService = {
  readonly emit: (input: EmitInput) => Effect.Effect<void>
}

class Reporter extends Context.Tag('veto/Reporter')<
  Reporter,
  ReporterService
>() {}

export { type ReportFormat, type EmitInput, type ReporterService, Reporter }
