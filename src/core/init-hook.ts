const hookCommand = 'npx veto .veto/ --staged'

const hookLine = `git rev-parse -q --verify MERGE_HEAD >/dev/null || ${hookCommand}`

type HookAppend = {
  readonly changed: boolean
  readonly text: string
}

const withTrailingNewline = (text: string): string =>
  text === '' || text.endsWith('\n') ? text : `${text}\n`

const appendHookLine = (existing: string): HookAppend =>
  existing.includes(hookCommand)
    ? { changed: false, text: existing }
    : { changed: true, text: `${withTrailingNewline(existing)}${hookLine}\n` }

export { type HookAppend, hookCommand, hookLine, appendHookLine }
