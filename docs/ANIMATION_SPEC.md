# Animation Spec

## Principle

Animation must communicate state. Avoid motion that exists only to look busy.

Target active rendering: 60 fps.

When hidden, suspend character rendering and unnecessary polling.

## Character baseline

### Breathing
- cycle: 3200–3800 ms
- scale change: 1.0 -> 1.025 vertically
- width compensation: subtle
- never use a simple linear yoyo

### Blink
- average interval: 4.5–8.5 s
- randomized, not fixed
- close: 45–60 ms
- hold: 20–35 ms
- open: 80–120 ms
- occasional double blink: low probability

### Gaze
- update each frame while pointer is near
- clamp pupil/eye target to a small ellipse
- smooth with critically damped interpolation
- no instant snapping

### Idle drift
- amplitude: 1.5–3 px
- multiple non-matching sine frequencies
- almost imperceptible

## Island transitions

### hidden -> peek
- 140–180 ms
- translation from y=-8 to y=0
- opacity 0 -> 1
- ease-out cubic

### peek -> compact
- 180–240 ms
- spring-like width/height morph
- overshoot <= 4%
- character emerges slightly after container starts

### compact -> expanded
- 220–320 ms
- content fades/slides in after 40–70 ms
- radius interpolation must remain smooth
- avoid simultaneous opacity of all children

### expanded -> compact
- content exits first
- container collapses 40–60 ms later
- 180–240 ms total

## Click reactions

### Single click on Nox
1. 70 ms compression
2. 130 ms rebound
3. annoyed eye expression for 450–700 ms

Body:
- scaleX: 1.08
- scaleY: 0.88
- return with slight overshoot

### Triple click within 650 ms
Dizzy state:
- eyes orbit / cross briefly
- body wobble decays over 1.8–2.4 s
- ignore repeated trigger until complete

## Agent states

### Thinking
- slow eye scan
- tiny orbiting status dot
- no constant spinner if text already says “Thinking”

### Editing
- character leans toward activity text
- tiny rhythmic side motion synchronized to file-event bursts

### Running command
- compact terminal glyph pulse
- avoid fake progress if actual progress unknown

### Finished
- 420–650 ms hop
- squash before lift
- one small sparkle burst
- return to calm within ~1.2 s

### Failed
- quick 2–3 px downward drop
- eyes narrow
- no dramatic shake unless it is a user-visible failure

## File drop

When drag enters:
- island expands within 160 ms
- Nox rotates/reconfigures to reveal a “catch” cavity
- dashed drop affordance fades in

On drop:
- file card falls 8–12 px into island
- Nox reacts
- 250–400 ms settle

## HUD events

Volume / brightness:
- replace normal content rather than stacking
- 120–160 ms entrance
- hold 900–1200 ms after last input
- 160–220 ms exit

Bluetooth:
- device icon + name
- 1.6–2.4 s total unless interacted with

Battery charging:
- short energy pulse toward battery icon
- no endless animation

## Motion implementation

Prefer:
- requestAnimationFrame
- transforms and opacity
- Canvas for Nox
- CSS transitions only for simple panel content
- spring integration for major island morphs

Avoid:
- layout-thrashing width animations every frame where transform can work
- setInterval for animation
- large blur filters changing every frame
