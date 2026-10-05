# State Machine

## Container states

```text
HIDDEN
  -> PEEK
  -> COMPACT
  -> EXPANDED
  -> MODAL
```

## Event states

```text
IDLE
HOVER
MEDIA
SYSTEM_HUD
AGENT_THINKING
AGENT_EDITING
AGENT_RUNNING
AGENT_PERMISSION
AGENT_DONE
AGENT_FAILED
FILE_DRAG
FILE_RECEIVED
NOTIFICATION
PRIVACY_ACTIVE
TIMER
```

## Transition rules

### HIDDEN
- no visible UI
- top-edge sensor active
- expensive rendering paused

On pointer entering sensor:
`HIDDEN -> PEEK`

On priority event:
`HIDDEN -> COMPACT` or `MODAL`

### PEEK
- minimal visual acknowledgement
- no text unless needed

Pointer remains > 160 ms:
`PEEK -> COMPACT`

Pointer leaves:
`PEEK -> HIDDEN`

### COMPACT
- primary working state
- one-line information

Click:
`COMPACT -> EXPANDED`

Priority permission:
`COMPACT -> MODAL`

### EXPANDED
- rich content / controls
- optional quick prompt
- can accept file drop

Outside click or Escape:
`EXPANDED -> COMPACT`

Inactivity:
`EXPANDED -> COMPACT -> HIDDEN`

### MODAL
Used only for:
- permission decision
- destructive confirmation
- security warning

Must not auto-hide while unresolved.

## Arbitration

When multiple events arrive, compare priority.

Example:

```text
privacy > permission > failure > file-drop > agent > HUD > media > hover
```

Lower-priority events queue briefly or are discarded if stale.

Do not display a 10-second-old volume event after a permission dialog closes.
