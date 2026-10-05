# Codex local socket protocol

The bridge listens only at:

```text
$XDG_RUNTIME_DIR/nox-island/codex-events.sock
```

Its parent directory is created with `0700` permissions and the socket with `0600`; it never binds a network address.

Send newline-delimited JSON matching `docs/CODEX_INTEGRATION.md`, for example:

```json
{ "type": "file_edit", "sessionId": "abc", "path": "src/main.ts" }
```

For a `permission_requested` event, the client keeps the connection open. When the user makes a choice, Nox replies on that same connection:

```json
{
  "type": "permission_resolved",
  "requestId": "request-42",
  "decision": "allow"
}
```

## User-initiated requests

The same connection may receive a request only after a user explicitly submits
the Quick Assistant form or clicks **Attach** on a dropped file. The two
outbound message shapes are:

```json
{
  "type": "quick_assistant",
  "requestId": "a-local-request-id",
  "prompt": "Summarize the user-selected file notes.md.",
  "sessionId": "optional-active-session",
  "filePath": "/absolute/path/selected-by-user"
}
```

```json
{ "type": "file_attach", "path": "/absolute/path/selected-by-user" }
```

The bridge client can report progress or a reply back to the island:

```json
{ "type": "assistant_status", "requestId": "a-local-request-id", "status": "Reading context" }
{ "type": "assistant_response", "requestId": "a-local-request-id", "text": "Local response text" }
```

Nox never sends a dropped path, file contents, prompt, or key to a remote
provider itself. Malformed messages are discarded; they are never interpreted
as commands. The bridge does not provide a network listener, execute shell
commands, or manufacture progress values.
