# Test Plan

## Visual snapshots

Capture at:
- 100% scale
- 125% scale
- 150% scale
- 200% scale

States:
- hidden
- peek
- compact
- expanded
- permission
- file drop
- media
- volume
- success
- failure

## Animation tests

Measure:
- frame pacing
- dropped frames
- transition duration
- no layout jump
- no geometry clipping

Stress:
- rapid pointer enter/leave
- repeated volume key
- rapid agent events
- permission arriving during media
- file drag during active agent
- display scale change while expanded

## Linux matrix

Target first:
- Ubuntu latest / GNOME 50 / Wayland
- NVIDIA and Intel/AMD if available

Then:
- X11 fallback
- Fedora GNOME
- fractional scaling
- external monitor

## Failure tests

- DBus service unavailable
- MPRIS player closes mid-animation
- Bluetooth device disappears
- invalid agent event JSON
- stale permission request
- file no longer exists after drop
- secret service locked
