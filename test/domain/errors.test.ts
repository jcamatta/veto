import { describe, expect, it } from 'vitest'
import { Effect, Exit } from 'effect'
import {
  agentUnavailable,
  configError,
  findingsParseError,
  gitError,
  type ReviewError
} from '../../src/domain/errors.js'

describe('domain errors', () => {
  it('constructors produce the right tags', () => {
    expect(gitError('boom')._tag).toBe('GitError')
    expect(configError('boom')._tag).toBe('ConfigError')
    expect(agentUnavailable('boom')._tag).toBe('AgentUnavailable')
    expect(findingsParseError('boom')._tag).toBe('FindingsParseError')
  })

  it('carries the message', () => {
    expect(gitError('not a git repo').message).toBe('not a git repo')
  })

  it('discriminates with Effect.catchTags', () => {
    const program = Effect.fail(agentUnavailable('credit exhausted')).pipe(
      Effect.catchTags({
        AgentUnavailable: (error) => Effect.succeed(`fail-open: ${error.message}`)
      })
    )
    const exit = Effect.runSyncExit(program)
    expect(exit).toEqual(Exit.succeed('fail-open: credit exhausted'))
  })

  it('leaves other tags uncaught', () => {
    const failing: Effect.Effect<never, ReviewError> = Effect.fail(gitError('boom'))
    const program = failing.pipe(
      Effect.catchTags({
        AgentUnavailable: () => Effect.succeed('fail-open')
      })
    )
    const exit = Effect.runSyncExit(program)
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
