import picomatch from 'picomatch'
import { normalizePath, resolveWithin } from './path-normalize.js'

type ToolCall = {
  readonly repoRoot: string
  readonly tool: string
  readonly path: string | null
  readonly scope: readonly string[] | null
}

type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string }

const allowedTools: ReadonlySet<string> = new Set(['Read', 'Grep', 'Glob'])

const deniedPrefix = '.reviewer/runs'

const deny = (reason: string): PolicyDecision => ({ allowed: false, reason })

const allow: PolicyDecision = { allowed: true }

const relativeToRoot = (call: ToolCall): string | null => {
  const root = normalizePath(call.repoRoot)
  const resolved = resolveWithin({ root, path: call.path ?? '.' })
  if (resolved === root) {
    return ''
  }
  return resolved.startsWith(`${root}/`)
    ? resolved.slice(root.length + 1)
    : null
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
  if (relative === deniedPrefix || relative.startsWith(`${deniedPrefix}/`)) {
    return deny(`reads into ${deniedPrefix}/ are denied`)
  }
  if (relative !== '' && !checkScope(call)(relative)) {
    return deny(`path "${relative}" is outside the reviewer's declared scope`)
  }
  return allow
}

export { type ToolCall, type PolicyDecision, evaluateToolCall }
