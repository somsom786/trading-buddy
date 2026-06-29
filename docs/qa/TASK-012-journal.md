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

- Full Hermes Desktop lint is now clean.
- Windows-safe `npm run fmt --workspace apps/desktop` is now clean.
- Hermes Desktop typecheck and production build pass.
- Petdex pack build and manifest tests pass.
- Developer packaging is documented in `docs/reformation/DEVELOPER-PACKAGING.md`.
- `npm run pack --workspace apps/desktop` created an unpacked Windows developer package at
  `next/agent/apps/desktop/release/win-unpacked/Trading Buddy.exe`.
- Migration is explicitly decided as no automatic migration for the Task 12 preview, implemented
  through isolated runtime paths and documentation.
- Full upstream Hermes Desktop UI tests still fail on unrelated existing test drift.
- Full upstream platform tests still have update-relaunch failures on this Windows/bash path
  combination.
- Multi-monitor human interaction QA remains pending.
