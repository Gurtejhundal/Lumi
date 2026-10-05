# Nox Island gesture-first redesign QA

## Comparison target

- Source visual truth: `/tmp/codex-clipboard-36ff39d1-d30a-4d60-a7ef-e89fc1e679ec.png`
  (970 × 270 px). It shows the former developer state board.
- Requested design decision: remove that board and expose every primary action
  through the top-center island only.
- Implementation evidence: browser-rendered capture of
  `http://127.0.0.1:4173/` in the Codex in-app Browser on 2026-10-05.
  Native Wayland validation remains outstanding; a browser capture cannot
  validate native window geometry, focus, or input passthrough.
- Normalization: comparison is intentional behavior redesign rather than
  pixel-for-pixel equivalence. The source board is evaluated as a removed
  development-only surface; the island's dark material, compact top-center
  placement, type scale, and character are the shared visual language.

## States and interactions tested

- Browser preview: one petit, Nox-only top-center island and no visible
  developer board.
- The native gesture, focus, and Wayland input-boundary checks have not run.

## Findings

Native review is blocked, so this document does not record a passing QA result.

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

## Validation required before sign-off

- Build and launch the Tauri shell on Ubuntu GNOME Wayland.
- Verify each native backing-window size, passive focus behavior, and that
  surrounding desktop content remains clickable.
- Test direct touchscreen hardware for multi-touch centroid gestures. GNOME
  owns global trackpad gestures, so they are intentionally out of scope for a
  normal Tauri client.

final result: blocked — native Tauri/Cargo validation is unavailable in this environment.
