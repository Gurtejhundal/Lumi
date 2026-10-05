# Codex Master Build Prompt

Build the project described in this repository into a production-quality Ubuntu/GNOME 50 top-edge companion.

Read all files in `docs/` before writing implementation code.

## Non-negotiable architecture

- Tauri 2
- Rust backend
- TypeScript frontend
- transparent always-on-top top-center overlay
- Wayland-first design
- layer-shell integration where required
- procedural Canvas 2D character
- no copied Coucou/Mochi assets

## First milestone

Do not start DBus/Codex integration until the visual prototype is matched.

Implement:

1. hidden top-edge sensor
2. peek state
3. compact state
4. expanded state
5. original Nox character
6. breathing
7. randomized blink
8. gaze tracking
9. click squash/rebound
10. triple-click dizzy
11. working state
12. permission state
13. done state
14. file-drop state

## Quality bar

The result must not look like a generic toast.

Use:
- coordinated container + character animation
- spring-like morphs
- staggered content
- 60 fps transforms
- restrained color
- exact spacing tokens

Avoid:
- emojis as primary UI icons
- giant glass panels
- constant spinners
- fake progress
- copied assets
- focus stealing

## Validation before each milestone

Run:
- formatter
- typecheck
- tests
- production build

Then manually verify the acceptance checklist.

When a Linux API is unavailable on the current machine, implement a typed adapter and mock event source rather than hard-coding fake success.
