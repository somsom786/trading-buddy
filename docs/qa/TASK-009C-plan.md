# Task 9C QA Plan - Hyperliquid foundation hardening

**Date:** 2026-06-25  
**Project label:** Trading Buddy BETA v0.2  
**Scope:** Hardening checkpoint for the read-only Hyperliquid foundation.

## Safety boundary

- Keep Hyperliquid access read-only.
- Do not add private-key, seed-phrase, signing, wallet SDK, order placement, order cancellation,
  withdrawal, transfer, arbitrary RPC, arbitrary URL, cloud, telemetry, or autonomous trading paths.
- Fixture and live public-address flows must use the same validation and storage boundaries.

## Baseline

Before implementation, run:

1. `corepack pnpm check`
2. `corepack pnpm build`
3. `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
4. `cargo test --manifest-path src-tauri/Cargo.toml`
5. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
6. `corepack pnpm tauri build --debug --no-bundle`
7. `corepack pnpm tauri build --no-bundle`
8. `git diff --check`

## Implementation checkpoints

1. Add schema support for fixture scenario identity instead of storing scenario names as display
   names.
2. Add deterministic fixture addresses so multiple fixture scenarios can exist side by side.
3. Add active sync coalescing, progress state, and cancellation.
4. Record cancelled/failed sync runs without overwriting the last good saved data.
5. Add fixture scenarios for slow sync, cancellation, duplicate-heavy data, and 100/1,000/10,000
   fill performance fixtures.
6. Expose scenario listing, diagnostics, progress, and cancellation through narrow frontend service
   methods.
7. Add a development-only Trading Lab for scenario creation, repeat sync, cancellation, and
   diagnostics.
8. Tighten deterministic trading-intent helpers and tests.

## Verification after implementation

Run:

1. `corepack pnpm check`
2. `corepack pnpm build`
3. `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
4. `cargo test --manifest-path src-tauri/Cargo.toml`
5. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
6. `corepack pnpm tauri build --debug --no-bundle`
7. `corepack pnpm tauri build --no-bundle`
8. `git diff --check`

## Manual QA still recommended

- Open Companion Home in development mode and expand Trading Lab.
- Add `single_long`, `duplicate_heavy`, and `performance_100_fills` fixtures.
- Sync a fixture twice and confirm unchanged counts increase for duplicate rows.
- Add `slow_sync`, start sync, click cancel during the run, and confirm the progress state and sync
  diagnostics show cancellation.
- Confirm no write/trading controls appear anywhere in the UI.
