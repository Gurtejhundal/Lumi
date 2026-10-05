# Nox Island — Ubuntu/GNOME Companion Starter

This is a **design + engineering starter pack**, not a finished production app.

Goal: build a Coucou-level top-edge companion for Ubuntu/GNOME 50 with a distinct character, strong animation quality, Codex integration, system events, file drop, media, notifications, and permission cards.

## Direction

- Main app architecture: **Tauri 2 + Rust + TypeScript**
- Linux positioning: transparent always-on-top top-center overlay
- Wayland target: layer-shell based top overlay
- Character rendering: **procedural Canvas 2D**, no copied character assets
- Motion: 60 fps where active; event-driven / throttled when hidden
- Character: **Nox**, an original rounded manta/comet form
- State model: `hidden -> peek -> compact -> expanded -> modal`
- First priority: visual quality and motion, then integrations

## What is inside

- `docs/PRODUCT_SPEC.md` — product behavior and scope
- `docs/VISUAL_DIRECTION.md` — island proportions, glass, spacing, typography
- `docs/ANIMATION_SPEC.md` — exact motion rules, timing and easing
- `docs/CHARACTER_SPEC.md` — Nox geometry and behavior
- `docs/STATE_MACHINE.md` — interaction states and transitions
- `docs/ARCHITECTURE.md` — recommended app architecture
- `docs/LINUX_INTEGRATIONS.md` — GNOME/Linux APIs to connect
- `docs/CODEX_INTEGRATION.md` — Codex event model
- `docs/SECURITY_AND_PRIVACY.md` — secret handling and permissions
- `docs/ROADMAP.md` — build phases
- `docs/ACCEPTANCE_CHECKLIST.md` — definition of done
- `docs/TEST_PLAN.md` — visual, motion and Linux tests
- `docs/ASSET_LICENSE_RULES.md` — what must not be copied
- `prompts/CODEX_MASTER_PROMPT.md` — build prompt for Codex
- `prototype/` — interactive browser prototype for visual/motion direction

## Preview the prototype

From this folder:

```bash
cd prototype
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:4173
```

The prototype now covers the Phase 1–8 roadmap under `prototype/src-tauri/`.
Browser mode remains useful for visual review. Native mode adds the local Codex
socket, UPower/NetworkManager event adapters, MPRIS discovery/controls, native
file-drop metadata/actions, and a bridge-only quick assistant when the
corresponding desktop services are available.

## Phase 0 verification

```bash
cd prototype
npm run format
npm run typecheck
npm run test
npm run build
```

## Native integrations

After installing Rust/Cargo and the Tauri Linux development dependencies, start the desktop shell with:

```bash
cd prototype
npm run tauri:dev
```

The local-only Codex bridge protocol is described in `prototype/src-tauri/CODEX_SOCKET_PROTOCOL.md`.
Media commands are sent to the active MPRIS player; system cards appear only
from available system services, without synthesized success or progress. File
contents are never automatically read or uploaded: each file action requires a
click. Quick Assistant forwards to a connected local Codex peer and stores no
provider key.

## One-popup interaction model

The normal Nox Island UI has no developer control board. The popup is the
control surface:

- Tap/click Nox: Quick Assistant.
- Double-click Nox: media panel; triple-click keeps Nox's dizzy reaction.
- Press and hold, right-click, or swipe right: Preferences.
- Swipe left: media; swipe up: Quick Assistant; swipe down: hide.
- Scroll over the island: system HUD.
- On a touchscreen, two fingers open media, three fingers open the system HUD,
  and four fingers open Preferences.

Append `?demo=1` to the local preview URL only when you want the old developer
state board for visual testing. On GNOME Wayland, global touchpad gestures are
handled by Mutter and are not reliably delivered to a normal Tauri window; the
multi-finger mapping is therefore guaranteed for direct touchscreen pointers.

## Release workflow

```bash
cd prototype
npm run tauri:build
```

The Tauri bundle configuration targets Debian packages and AppImage. It needs
Rust/Cargo and the usual Tauri Linux build dependencies installed on the build
machine.

## Non-negotiables

1. Do not copy Coucou's protected name, Mochi character, icon, sounds, or media.
2. Reuse only ideas/interaction patterns and MIT-licensed code where license terms are followed.
3. Nox must look visibly distinct from Mochi.
4. Avoid a generic “black rounded rectangle with text” result.
5. Motion quality is a product feature, not decoration.
6. Every state must have an entrance, hold, and exit behavior.
7. The island must not steal keyboard focus during passive states.
