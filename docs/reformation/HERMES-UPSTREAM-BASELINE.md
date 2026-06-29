# Hermes Upstream Baseline

Date: June 29, 2026

Trading Buddy's Task 12 reformation track vendors the `somsom786/hermes-agent` fork as a submodule
at `next/agent`. The fork preserves Hermes Desktop as the upstream runtime while adding
Trading Buddy companion defaults.

## Baseline principle

Use one canonical runtime:

- Hermes Desktop owns the main renderer, session stream, profile, and Petdex backend.
- The detached pet overlay is a puppet window. It mirrors pet state from the main renderer and sends
  narrow control messages back.
- Pet skins are selected through the existing Petdex gallery and settings code paths.
- No separate Trading Buddy skin store or fake selector should be added.

## Current checkpoint changes

- Added overlay control messages for:
  - `open-skins`
  - `open-journal`
  - `open-settings`
  - `bring-back`
  - `restart-buddy`
  - `quit`
- Main process focuses the main window before forwarding Petdex, journal, and settings requests.
- The companion tray now includes **Change Pet Skin**, which opens the same Petdex gallery.
- Main renderer registers handlers that route:
  - `open-skins` to `openCommandPalettePage('pets')`;
  - `open-settings` to Settings;
  - `open-journal` to the main chat composer with a journal seed.

## Known upstream validation caveats

Full workspace lint still reports unrelated upstream Hermes issues outside this checkpoint. They
should be fixed or pinned before claiming a clean global lint baseline.
