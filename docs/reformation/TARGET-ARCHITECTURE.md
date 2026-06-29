# Target Architecture

Task 12 introduces a `next/` architecture track while preserving the current Tauri product.

```text
Trading Buddy repository
  existing Tauri app
    current stable local-first baseline
  next/
    agent/
      Hermes Agent fork and Hermes Desktop fork
    packages/petdex-adapter/
      local Petdex manifest validation and pack checks
    pets/trading-buddy-default/
      bundled Trading Buddy Petdex pet
    packages/trading-buddy-soul/
      companion identity, safety, support modes, and state schema
    skills/trader-companion/
      local-first trader companion skill
    scripts/
      dev launcher and pet-pack builder
```

## Runtime goal

The new vertical slice runs Trading Buddy as:

- a transparent always-on-top Petdex buddy;
- a hidden main window by default;
- a tray with Open Buddy, Bring Buddy Back, Open Main Window, and Quit;
- a shared pet composer/session path into Hermes;
- local Ollama through an OpenAI-compatible loopback endpoint;
- an isolated `HERMES_HOME` under `%LOCALAPPDATA%\TradingBuddy\hermes`;
- an isolated Electron user-data directory under `%LOCALAPPDATA%\TradingBuddy\desktop`;
- a no-tools default companion toolset.

## Safety shape

The companion mode starts from conversation only. The configured toolset is:

```text
trading-buddy-companion = []
```

This means default pet conversation can stream through the local model and persist a Hermes session,
but cannot call file, shell, browser, network, wallet, exchange, or trading tools.

## Relationship to current Tauri app

The current Tauri app remains the stable implementation of existing functionality. The Hermes track
is an experimental reformation slice for companion-first runtime, Petdex body, and Hermes session
architecture.
