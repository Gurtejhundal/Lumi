# Nox Island gesture-first redesign QA

## Comparison target

- Source visual truth: `/tmp/codex-clipboard-36ff39d1-d30a-4d60-a7ef-e89fc1e679ec.png`
  (970 × 270 px). It shows the former developer state board.
- Requested design decision: remove that board and expose every primary action
  through the top-center island only.
- Implementation evidence: browser-rendered capture of
  `http://127.0.0.1:4173/` in the Codex in-app Browser on 2026-10-05
  (1067 × 900 px, default compact state). The browser capture is retained in
  the task transcript; no filesystem screenshot export is available from this
  browser surface.
- Normalization: comparison is intentional behavior redesign rather than
  pixel-for-pixel equivalence. The source board is evaluated as a removed
  development-only surface; the island's dark material, compact top-center
  placement, type scale, and character are the shared visual language.

## States and interactions tested

- Normal URL: one compact top-center island and no visible developer board.
- Single click/tap on Nox: local Quick Assistant panel.
- Double-click on Nox: media panel with playback controls.
- Reduced-motion, keyboard focusable controls, semantic form labels, and
  compact clipping at the default desktop viewport were reviewed.

## Findings

No actionable P0, P1, or P2 findings.

- Intentional difference — the former state board is hidden unless the preview
  URL explicitly includes `?demo=1`. This is the requested one-popup model.
- Typography: the compact headline intentionally truncates long text rather
  than widening the always-visible island; expanded states expose the full
  context.
- Layout and spacing: the compact island remains centered at the top edge with
  no bottom control surface competing for attention.
- Colors and surfaces: the near-black island, restrained highlight, border,
  and shadow retain the source's premium dark visual language.
- Image/asset fidelity: no new visual asset was introduced; procedural Nox is
  the existing product character and remains distinct from the reference
  control board.
- Copy: the preference panel contains the interaction map rather than placing
  permanent instructions outside the island.

## Follow-up polish

- P3: test direct touchscreen hardware for two-, three-, and four-touch input
  once the native Tauri shell can be compiled.
- P3: a GNOME-specific bridge can be evaluated later if system-wide trackpad
  gesture capture is essential; Mutter does not expose those gestures to a
  normal Wayland client.

final result: passed
