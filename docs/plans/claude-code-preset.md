# claude_code preset system prompt

## Motivation

PLAN.md Phase 9 task 5 — the last open Phase 9 item. Today the reviewer's
`systemPrompt` and rules are concatenated into one big user prompt; the SDK
runs with its default system prompt. Sending the reviewer persona as a
proper system prompt on top of the `claude_code` preset gives an agent tuned
for unattended repo work, and `excludeDynamicSections: true` keeps the
prompt static and cacheable across machines. `settingSources` stays `[]` —
no CLAUDE.md/AGENTS.md auto-injection, because any input that changes review
output must be part of the Layer-1 cache key.

## Behavior

- `buildPrompt` returns `{ system, user }`: the reviewer persona
  (`config.systemPrompt`) and the rules render as the system text; staged
  files, diff, baseline, and the strict-JSON instruction stay in the user
  prompt. The parse-retry suffix still appends to the user prompt.
- `AgentRunInput` carries the system text as opaque data; adapters interpret
  or ignore it (the port stays backend-agnostic).
- The SDK adapter sends
  `systemPrompt: { type: 'preset', preset: 'claude_code', append: <system>,
  excludeDynamicSections: true }`.

## Steps

- [x] 1. `src/core/prompt.ts`: `buildPrompt` → `{ system, user }`;
  tests updated for the split and the retry suffix.
- [x] 2. `src/ports/agent.ts`: `AgentRunInput.system`.
- [x] 3. `src/adapters/sdk-agent.ts`: preset `systemPrompt` option; test
  asserts the option wiring.
- [x] 4. `src/engine/agent-session.ts` + `src/engine/run-reviewer.ts`: thread
  the split prompt through the session; engine tests updated (rules now
  asserted on `system`, diff/baseline on the user prompt).
- [x] 5. Docs: SPEC §5/§7, PLAN.md Phase 9 checked off, FILES.md.
