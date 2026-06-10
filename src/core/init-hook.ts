const hookLine = 'npx veto .veto/ --staged'

type HookAppend = {
  readonly changed: boolean
  readonly text: string
}

const withTrailingNewline = (text: string): string =>
  text === '' || text.endsWith('\n') ? text : `${text}\n`

const appendHookLine = (existing: string): HookAppend =>
  existing.includes(hookLine)
    ? { changed: false, text: existing }
    : { changed: true, text: `${withTrailingNewline(existing)}${hookLine}\n` }

export { type HookAppend, hookLine, appendHookLine }
