# Pet Experience Direction

Trading Buddy is pet-first. The desktop creature is the product surface; the main window is the
deeper inspection, settings, and conversation surface.

## Current 12B checkpoint

- The popped-out buddy keeps the existing Hermes/Petdex runtime as the single source of truth.
- The buddy exposes the existing Petdex gallery through **Skins** / **Change pet skin** instead of
  introducing a duplicate selector.
- Skin choice remains profile-scoped and persisted by the Petdex backend.
- Single-click opens a compact warm bubble for quick conversation.
- Right-click opens a custom game-like pet menu.
- The menu currently includes:
  - Talk
  - Change pet skin
  - Sit here
  - Stay quiet
  - Sleep
  - Wake up
  - Bring Buddy Back
  - Open Trading Buddy
  - Open Journal
  - Settings
  - Restart Buddy
  - Quit

## Visual direction

The companion UI should feel warm, tactile, playful, and premium:

- light-first cream/paper surfaces;
- tomato, mustard, olive, mint, lavender, peach, and sky accents;
- thick dark-brown borders;
- hard button shadows and press states;
- rounded game-like panels;
- compact layouts that feel attached to the pet rather than a generic chat product.

Avoid:

- Discord-like dark panels;
- generic dashboard cards;
- terminal-first styling;
- a ChatGPT-clone visual hierarchy.

## Current limitations

- Sleep and quiet are local UI status flags in the overlay checkpoint; they do not yet alter a full
  canonical pet behavior state machine.
- The journal action currently opens the main chat surface with a `Journal this:` seed because the
  Hermes reformation track does not yet have the preserved Tauri journal UI migrated.
- Streaming assistant response text is still handled by the main Hermes session UI, not rendered as
  a full transcript inside the detached pet bubble.
- Full multi-monitor, DPI, persistence, and real desktop manual QA remain required.
