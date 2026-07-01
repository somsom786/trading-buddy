# Task 12B — BETA v0.3 and default-branch publication

Date: 2026-07-01

## Outcome

The prior Task 12B correction was already pushed to
`origin/codex/task-12b-pet-skins-ui`, but GitHub's default `main` branch still pointed to the older
Task 11 checkpoint. This update advances the active development label to **BETA v0.3** (`0.3.0`)
and publishes the tested Task 12B history to `main`.

## Changes

- Updated the README title and current repository label to BETA v0.3.
- Updated current product and progress documentation.
- Updated frontend package, Tauri, and Rust package metadata to `0.3.0`.
- Updated current application window, buddy, tray, Companion Home, and read-only sync labels.
- Kept historical reports and QA journals at the version they originally documented.
- Corrected stale product-direction wording: Trading Buddy owns the Tauri/React frontend, Hermes
  supplies backend/session logic only, and Petdex remains an optional validated skin source.

## Architecture

This is a development-label and publication checkpoint. It does not change the local-first
boundary, introduce wallet secrets, enable autonomous trading, or claim Task 12B completion.

## Verification

The required project commands were run after the version update:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri build --debug
```

Results:

- Prettier: passed.
- ESLint: passed with zero warnings.
- Strict TypeScript: passed.
- Vitest: 47 files, 175 tests passed.
- Rust: 89 tests passed.
- Tauri debug build: passed and produced BETA v0.3 MSI and NSIS installers.

No new interactive Windows walkthrough was required for this label/publication-only change. The
existing Task 12B implementation was previously live-smoked on Windows.

## Remaining work

Task 12B remains open for the canonical Tauri-to-Hermes shared-session stream, stop/retry/copy,
reconnect and duplicate safety, and the complete Windows acceptance walkthrough.
