# Task 12 QA Journal

## June 29, 2026

- Tagged the pre-reformation Trading Buddy baseline as `pre-task-12-tauri-b72c97a`.
- Forked Hermes Agent to `https://github.com/somsom786/hermes-agent`.
- Added Hermes as a submodule at `next/agent`.
- Built a Petdex-compatible Trading Buddy atlas from existing temporary pose assets.
- Added a no-tools Hermes toolset named `trading-buddy-companion`.
- Added an isolated local launcher for `%LOCALAPPDATA%\TradingBuddy`.
- Verified the pet overlay opens as the visible default surface while the main window remains
  hidden.
- Verified pet click opens the composer.
- Verified pet composer to Hermes TUI gateway to local Ollama to persisted Hermes session.
- Verified a local response streamed in chunks and used zero tools.

## Open QA

- Full upstream Hermes Desktop lint/test suites still fail on unrelated upstream issues.
- Multi-monitor human interaction QA remains pending.
- Production packaging of the Hermes track remains pending.
- Tauri-to-Hermes data migration remains pending.
