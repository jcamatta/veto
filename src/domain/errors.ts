type GitError = { readonly _tag: 'GitError'; readonly message: string }

const gitError = (message: string): GitError => ({ _tag: 'GitError', message })

type ConfigError = { readonly _tag: 'ConfigError'; readonly message: string }

const configError = (message: string): ConfigError => ({
  _tag: 'ConfigError',
  message
})

type AgentUnavailable = {
  readonly _tag: 'AgentUnavailable'
  readonly message: string
}

const agentUnavailable = (message: string): AgentUnavailable => ({
  _tag: 'AgentUnavailable',
  message
})

type FindingsParseError = {
  readonly _tag: 'FindingsParseError'
  readonly message: string
}

const findingsParseError = (message: string): FindingsParseError => ({
  _tag: 'FindingsParseError',
  message
})

type ReviewError = GitError | ConfigError | AgentUnavailable | FindingsParseError

export {
  type GitError,
  type ConfigError,
  type AgentUnavailable,
  type FindingsParseError,
  type ReviewError,
  gitError,
  configError,
  agentUnavailable,
  findingsParseError
}
