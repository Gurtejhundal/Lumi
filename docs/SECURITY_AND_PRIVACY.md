# Security and Privacy

## Rules

1. No telemetry by default.
2. No microphone recording for character animation.
3. No screenshots unless user explicitly invokes a feature requiring them.
4. No file upload on drag/drop without confirmation.
5. No API key stored in plaintext.
6. No shell command execution from arbitrary notification text.
7. Permission cards must display what is being approved.
8. Passive island states should never capture keyboard focus.
9. Local agent socket must not listen on external interfaces.
10. Sanitize filenames and shell arguments.

## Permission UX

Permission dialog must show:
- requesting tool
- requested action
- affected path/command where available
- Allow
- Deny

Do not use deceptive color or placement.

Default focus should not accidentally approve a dangerous action.
