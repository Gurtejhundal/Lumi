# Codex Integration

## Goal

The island should show useful Codex activity without pretending to know progress that Codex does not expose.

## Normalized agent events

```ts
type AgentEvent =
  | { type: "session_started"; sessionId: string; cwd?: string }
  | { type: "thinking"; sessionId: string; summary?: string }
  | { type: "file_read"; sessionId: string; path: string }
  | { type: "file_edit"; sessionId: string; path: string }
  | { type: "command_started"; sessionId: string; command: string }
  | { type: "command_finished"; sessionId: string; exitCode: number }
  | { type: "permission_requested"; sessionId: string; requestId: string; label: string }
  | { type: "permission_resolved"; sessionId: string; requestId: string; decision: "allow" | "deny" }
  | { type: "session_finished"; sessionId: string; outcome: "success" | "failed" | "cancelled" }
```

## Transport

Preferred:
- local Unix socket under `$XDG_RUNTIME_DIR`
- small hook/bridge process emits JSON lines

Requirements:
- local-only
- authenticated by filesystem permissions
- no network listener by default
- malformed events rejected

## UI mapping

Thinking:
`Nox + "Codex is thinking"`

Read:
`Reading src/...`

Edit:
`Editing extension.js`

Command:
`Running npm test`

Permission:
Expanded modal with explicit action.

Finished:
Nox success reaction + concise result.

Failed:
Failure card with action to open terminal/log context.

## Important

Do not invent percentage progress unless Codex provides a real measurable quantity.

Use activity stages, not fake "82%" completion.
