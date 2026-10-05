# Character Spec — Nox

## Important

Nox must be visually distinct from Coucou's Mochi.

Do not use:
- a soft rounded square/squircle body as the main silhouette
- Mochi's face proportions
- Mochi artwork
- Mochi sounds
- Mochi iconography

## Concept

Nox is a tiny **rounded manta/comet**.

Silhouette:
- shallow central head
- two soft side wings
- short tapered tail
- low center of gravity
- designed to fit inside a 38–54 px high island

Face:
- two narrow luminous eye shapes rather than large circular eyes
- no mouth in the default state
- expression mainly through eye angle, wing posture and body tilt

This keeps Nox readable at small size while making it visually unrelated to Mochi.

## Procedural geometry

Recommended control points:

- center body ellipse
- left/right wing Bezier curves
- tail Bezier
- eye capsules cut or drawn on top

All geometry should be generated from one normalized coordinate system.

Example normalized bounds:

```text
x: -1.0 .. 1.0
y: -0.55 .. 0.55
```

Animation modifies geometry parameters rather than swapping images.

## Parameters

```text
breath
wingLift
squashX
squashY
tilt
tailCurl
eyeOpen
eyeSlant
gazeX
gazeY
glow
emotion
```

## Emotions

Minimum v1:

- neutral
- curious
- working
- pleased
- annoyed
- dizzy
- worried
- sleepy

## Distinct reactions

### Hover
Wings lift slightly and eyes widen.

### Pointer tracking
Eyes track cursor. Body turns only slightly.

### Happy
Wings rise, body hops, eyes arc upward.

### Annoyed
One wing lowers and eye slant becomes asymmetrical.

### Dizzy
Eye highlights orbit in opposing directions while tail curls.

### Low battery
Body droops, eye brightness reduces slightly.

### Music
Subtle wing bounce locked loosely to beat-energy estimates if available.

## Sound

Do not copy Coucou sounds.

For v1, ship silent by default.

If sound is added:
- short custom synthesized ticks/chirps
- user-controllable master toggle
- no sound for every minor state change
