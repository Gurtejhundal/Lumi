# Product Spec

## Product goal

Create a top-center desktop companion for Ubuntu/GNOME that feels alive and useful without becoming a permanent distraction.

The product should combine:

- dynamic-island style system HUD
- coding-agent monitor
- lightweight assistant surface
- expressive original character
- file drop target
- media/system controls
- notification surface

## Core jobs

### 1. Coding-agent awareness

Show when Codex or another supported agent is:

- idle
- thinking
- reading
- editing
- running a command
- waiting for approval
- finished
- failed

The user should be able to approve or deny supported permission requests from the island when safe and technically available.

### 2. System HUD

Short-lived island states for:

- volume
- brightness
- microphone active
- camera active
- Bluetooth device connected/disconnected
- battery charging / low battery
- Wi-Fi changes
- media playback
- timer completion

### 3. Character layer

Nox is present only when it improves the interaction.

Nox reacts to:

- pointer proximity
- click
- repeated click
- successful task
- failed task
- file drop
- low battery
- music
- long agent runs

### 4. Drop zone

Dropping a file on the top-center region should:

1. expand the island
2. visually accept the file
3. show filename/type/size
4. offer contextual actions
5. never upload automatically

Potential actions:

- attach to current agent request
- copy path
- open containing folder
- summarize
- inspect metadata
- send to configured workflow

### 5. Quick assistant

Expanded mode may include a short prompt input.

The assistant panel is not intended to replace a full ChatGPT/Codex interface. It is for:

- short commands
- approvals
- quick queries
- file actions
- current-agent context

## State priority

Highest wins:

1. security/privacy indicator
2. permission request
3. destructive/failure alert
4. incoming file drop
5. coding-agent active state
6. system HUD
7. media
8. hover/home
9. idle/hidden

## Out of scope for v1

- full chat history
- replacing GNOME notifications entirely
- full IDE
- multi-window project management
- remote desktop control
- hidden background recording
