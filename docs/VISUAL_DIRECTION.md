# Visual Direction

## Desired feel

Precise, compact, soft and alive.

Avoid:

- heavy neon
- gamer UI
- oversized glass cards
- permanent dashboard look
- excessive gradients
- generic rounded black rectangle
- character pasted beside text with no spatial relationship

## Island geometry

### Hidden
Only a 2–4 px invisible hover sensor at the top edge.

### Peek
Approx:
- width: 64–88 px
- height: 8–14 px
- shape: shallow black arc/capsule

### Compact
Approx:
- width: 110–170 px
- height: 34–42 px
- corner radius: 18–22 px

### Expanded
Approx:
- width: 300–420 px
- height: 112–220 px
- corner radius: 28–34 px

### Modal / permission
Approx:
- width: 360–460 px
- height: content-driven
- maximum height: 360 px

## Surface

Primary island:
- near-black, not pure black
- subtle vertical luminance variation
- 1 px inner highlight
- very soft outer shadow
- optional backdrop blur when compositor permits
- avoid visible grey borders

Suggested tokens:

```css
--island-bg: rgba(7, 8, 10, .94);
--island-bg-soft: rgba(16, 18, 22, .90);
--hairline: rgba(255,255,255,.10);
--text: rgba(255,255,255,.96);
--text-secondary: rgba(255,255,255,.62);
--text-tertiary: rgba(255,255,255,.38);
```

## Layout

Compact:
- character on left or centered when alone
- state icon may replace character for system HUDs
- primary line vertically centered
- no more than one secondary indicator

Expanded:
- 20–24 px outer padding
- character has a real stage, not just an icon slot
- content aligned to a 4 px spacing system
- actions use compact capsules

## Typography

Use system UI font on Linux.

Recommended:
- primary: 13–14 px / 600
- secondary: 11–12 px / 450–500
- status number: tabular numerals
- avoid headline-style large type

## Character integration

Nox should appear to live inside the island.

Rules:
- body can partially occlude island edges
- eyes follow pointer within constrained angle
- character can lean toward active content
- shadows must match island lighting
- character motion and island morph happen in one coordinated timeline

## Color

The base island stays neutral.

Use accent color only for states:

- success: restrained mint/green
- warning: amber
- destructive: red
- agent thinking: cool violet/blue
- media: artwork-derived accent, low saturation
- privacy: bright green/orange indicators

Do not recolor the whole island for every event.
