# Task 12 QA Plan

## Scope

Verify the Hermes/Petdex reformation slice without claiming that it replaces the Tauri product.

## Automated checks

- Build the Petdex pack.
- Validate the Petdex manifest and atlas dimensions.
- Run focused Hermes Desktop companion-mode tests.
- Run focused pet overlay store tests.
- Run TypeScript checks for Hermes Desktop.
- Build Hermes Desktop.
- Run existing parent Trading Buddy checks.

## Runtime checks

- Launch through `next/scripts/dev.ps1 -SkipInstall`.
- Confirm isolated `%LOCALAPPDATA%\TradingBuddy` profile creation.
- Confirm hidden main window and visible pet overlay.
- Confirm backend starts with local Ollama model config.
- Confirm clicking the pet opens the composer.
- Confirm a message sent through the pet composer creates a Hermes session.
- Confirm local streaming chunks are received.
- Confirm no tools are used in the companion turn.
- Confirm shutdown does not leave the launched Electron/Python process tree running.

## Known suite risks

The upstream Hermes Desktop repository currently has full-suite lint/test failures unrelated to the
Task 12 changed files. Focused changed-file checks are required for this checkpoint, and upstream
failures must be documented rather than silently hidden.
