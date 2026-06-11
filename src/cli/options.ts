import { Args, Options } from '@effect/cli'
import type { Option } from 'effect'
import type { FailOn } from '../domain/fail-on.js'
import type { ReportFormat } from '../ports/reporter.js'

type CliArgs = {
  readonly dir: Option.Option<string>
  readonly config: readonly string[]
  readonly staged: boolean
  readonly format: ReportFormat
  readonly noCache: boolean
  readonly timeout: Option.Option<number>
  readonly failOn: FailOn
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

const timeout = Options.integer('timeout').pipe(
  Options.withDescription(
    'per-reviewer timeout in seconds (default 90; reviewer configs can override)'
  ),
  Options.optional
)

const failOn = Options.choice('fail-on', [
  'error',
  'warning',
  'info',
  'never'
]).pipe(
  Options.withDescription(
    'lowest finding severity that blocks the commit; never always exits 0 (default error)'
  ),
  Options.withDefault('error' as FailOn)
)

const cliOptions = { dir, config, staged, format, noCache, timeout, failOn }

export { type CliArgs, cliOptions }
