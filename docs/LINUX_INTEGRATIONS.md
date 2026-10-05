# Linux / GNOME Integrations

## Media

Use MPRIS over DBus.

Read:
- player identity
- track title
- artist
- artwork URI
- playback state
- position
- duration

Actions:
- play/pause
- previous
- next
- seek where supported

## Battery

Use UPower DBus.

Events:
- charging
- discharging
- percentage
- critical
- time remaining where available

## Bluetooth

Use BlueZ DBus.

Events:
- adapter on/off
- device connected/disconnected
- known device name
- battery when exposed

## Network

Use NetworkManager DBus.

Events:
- connectivity
- Wi-Fi on/off
- active SSID
- disconnect
- connection failure

## Audio / microphone

Use PipeWire/PulseAudio-compatible APIs or a suitable system abstraction.

Need:
- output volume
- mute
- active microphone indication where technically reliable

Do not claim microphone privacy detection unless the signal is trustworthy.

## Brightness

Prefer system backlight interfaces / DBus helpers available on the machine.

Do not assume all monitors expose brightness controls.

## Notifications

Integrate carefully.

v1 should mirror only selected notifications rather than replacing GNOME's notification system.

## File drop

Frontend receives drop.

Backend validates:
- path
- type
- size
- permissions

Never upload automatically.

## Secrets

Use Linux Secret Service:
- GNOME Keyring
- KWallet-compatible Secret Service when available

Never store API keys in plain JSON.
