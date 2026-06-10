import { Args, Options } from '@effect/cli'
import type { Option } from 'effect'
import type { ReportFormat } from '../ports/reporter.js'

type CliArgs = {
  readonly dir: Option.Option<string>
  readonly config: readonly string[]
  readonly staged: boolean
  readonly format: ReportFormat
  readonly noCache: boolean
}

const dir = Args.text({ name: 'config-dir' }).pipe(
  Args.withDescription(
    'a reviewer config file or a directory of reviewer YAML configs'
  ),
  Args.optional
)

const config = Options.text('config').pipe(
  Options.withDescription('path to a reviewer config file (repeatable)'),
  Options.repeated
)

const staged = Options.boolean('staged').pipe(
  Options.withDescription(
    'review the staged diff (v1 always reviews the staged diff)'
  )
)

const format = Options.choice('format', ['pretty', 'json']).pipe(
  Options.withDescription('output format for the run summary'),
  Options.withDefault('pretty' as ReportFormat)
)

const noCache = Options.boolean('no-cache').pipe(
  Options.withDescription('bypass the Layer-1 exact-replay cache')
)

const cliOptions = { dir, config, staged, format, noCache }

export { type CliArgs, cliOptions }
