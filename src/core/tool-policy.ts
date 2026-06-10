import picomatch from 'picomatch'
import {
  normalizePath,
  resolveWithin,
  type ResolveInput
} from './path-normalize.js'

type ToolCall = {
  readonly repoRoot: string
  readonly runsDir: string
  readonly tool: string
  readonly path: string | null
  readonly scope: readonly string[] | null
}

type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string }

type DenialCheck = {
  readonly call: ToolCall
  readonly relative: string
}

const allowedTools: ReadonlySet<string> = new Set(['Read', 'Grep', 'Glob'])

const deny = (reason: string): PolicyDecision => ({ allowed: false, reason })

const allow: PolicyDecision = { allowed: true }

const relativeWithin = (input: ResolveInput): string | null => {
  const root = normalizePath(input.root)
  const resolved = resolveWithin({ root, path: input.path })
  if (resolved === root) {
    return ''
  }
  return resolved.startsWith(`${root}/`)
    ? resolved.slice(root.length + 1)
    : null
}

const relativeToRoot = (call: ToolCall): string | null =>
  relativeWithin({ root: call.repoRoot, path: call.path ?? '.' })

const deniedByRunsDir = ({ call, relative }: DenialCheck): boolean => {
  const denied = relativeWithin({ root: call.repoRoot, path: call.runsDir })
  if (denied === null || denied === '') {
    return false
  }
  return relative === denied || relative.startsWith(`${denied}/`)
}

const checkScope = (call: ToolCall): ((rel: string) => boolean) =>
  call.scope === null ? () => true : picomatch([...call.scope], { dot: true })

const evaluateToolCall = (call: ToolCall): PolicyDecision => {
  if (!allowedTools.has(call.tool)) {
    return deny(`tool "${call.tool}" is not allowed in static mode`)
  }
  if (call.path === null) {
    return allow
  }
  const relative = relativeToRoot(call)
  if (relative === null) {
    return deny(`path "${call.path}" resolves outside the repo root`)
  }
  if (deniedByRunsDir({ call, relative })) {
    return deny('reads into the runs directory are denied')
  }
  if (relative !== '' && !checkScope(call)(relative)) {
    return deny(`path "${relative}" is outside the reviewer's declared scope`)
  }
  return allow
}

export { type ToolCall, type PolicyDecision, evaluateToolCall }
