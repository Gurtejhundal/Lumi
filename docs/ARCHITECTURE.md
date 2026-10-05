# Architecture

## Recommended stack

### Shell
Tauri 2

### Backend
Rust

Responsibilities:
- DBus integration
- Unix sockets for agent hooks
- secure secret storage adapter
- filesystem metadata
- process/window context where permitted
- event normalization
- Wayland overlay setup

### Frontend
TypeScript + DOM/Canvas

Responsibilities:
- state machine
- island layout
- Nox renderer
- animation engine
- interaction
- cards and controls

## Process model

```text
Agent hooks ─┐
DBus events ─┼─> Rust event bus ─> normalized events ─> frontend state machine
MPRIS ───────┤
UPower ──────┤
BlueZ ───────┤
NetworkMgr ──┘
```

## Window

Linux target:
- transparent
- borderless
- always-on-top
- top-center
- no taskbar/dock entry
- no focus stealing in passive modes
- input region restricted to visible/interactive island
- Wayland layer-shell preferred

The window should be wider than the visible island so it can expand without recreating the native window.

Suggested backing window:
- width: 520 px
- height: 420 px
- transparent

Visible island is rendered inside it.

## Frontend modules

```text
src/
  core/
    stateMachine.ts
    eventArbiter.ts
    timing.ts
  character/
    noxGeometry.ts
    noxRenderer.ts
    noxMotion.ts
    emotions.ts
  island/
    Island.ts
    transitions.ts
    layout.ts
  integrations/
    codex.ts
    media.ts
    system.ts
  ui/
    permissionCard.ts
    mediaCard.ts
    fileDropCard.ts
    hud.ts
```

## Performance rules

- no permanent 60 fps loop while hidden
- activate animation loop only when character/island is visible
- combine event bursts before repainting status text
- cache text metrics
- decode artwork asynchronously
- cap artwork resolution
- do not poll system state at high frequency when DBus signals exist
