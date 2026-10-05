# Native shell and release boundary

This directory hosts the Tauri 2 / Rust shell for Nox Island. It opens one transparent, borderless window centred at the top of the primary monitor, keeps it above normal application windows, removes the taskbar entry, and disables keyboard focus while passive. The backing window is resized around the visible surface plus a small safe margin: petit 116 × 38, compact 196 × 62, expanded 414 × 204, and modal 452 × 278 logical pixels.

## GNOME Wayland boundary

GNOME/Mutter does not provide the `wlr-layer-shell` protocol to normal third-party clients. Therefore no non-extension Tauri application can honestly promise panel-level anchoring or island-shaped input passthrough on GNOME Wayland.

The portable native-window fallback deliberately resizes the entire backing window for each visible surface rather than keeping a large transparent rectangle. `set_overlay_interaction` controls whole-window passthrough and focusability: passive states neither focus nor intercept desktop input, while text-entry states temporarily become focusable and focus their input. This is a pragmatic tradeoff, not shaped per-pixel input. A later optional, narrowly scoped GNOME bridge could provide compositor-level behavior without making the product itself a Shell extension.

## File drop and quick assistant

Nox reads only local metadata (name, size, and extension) for a file that the
user drops onto the island. Opening a containing folder, attaching a path, and
requesting a summary are each separate explicit actions. There is no automatic
upload or background content scan.

Quick Assistant is intentionally bridge-only: it forwards an explicit request
to the local Codex socket and has no HTTP provider or API-key field. That keeps
credential storage in the provider/agent that owns it instead of putting a
plaintext secret in this desktop overlay.

## Gesture boundary on GNOME Wayland

The island receives click, press-and-hold, wheel, swipe, and touchscreen
multi-touch input inside its own popup. GNOME/Mutter owns global trackpad
gestures on Wayland, so a normal Tauri app cannot reliably intercept two-,
three-, or four-finger trackpad gestures from elsewhere on the desktop. An
optional, narrowly scoped GNOME bridge would be needed for that system-wide
behavior; Nox does not pretend otherwise.

## Autostart

The official Tauri autostart plugin is linked but never enabled implicitly. It
is available in Preferences only after the user explicitly opts in.

## Packaging

`npm run tauri:build` produces `.deb` and AppImage targets when Rust and the
Tauri Linux build prerequisites are installed. Packaging is configured but is
not claimed as verified on a machine without Cargo.
