# Task 9E - Live sync and trade reconstruction

**Date:** 2026-06-25  
**Project label:** Trading Buddy BETA v0.2  
**Status:** E1 checkpoint complete. Full Task 9E live-sync/reconstruction scope remains pending.

## Correct completion state for this checkpoint

Trading Buddy BETA v0.2 now has Rust-owned active Hyperliquid account selection in local SQLite app
settings. The app does **not** yet have live WebSocket synchronization, HTTP reconciliation,
trade-episode reconstruction, or trading-session reconstruction.

## Baseline state

Baseline validation after creating/formatting the Task 9E QA plan/journal:

- `corepack pnpm check` - passed; 37 files and 132 frontend tests.
- `corepack pnpm build` - passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` - passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed; 63 Rust tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed.
- `corepack pnpm tauri build --debug --no-bundle` - passed.
- `corepack pnpm tauri build --no-bundle` - passed.
- `git diff --check` - passed.

No pre-existing app/test failures were observed. The very first baseline `pnpm check` attempt only
failed because the newly-created QA journal needed Prettier formatting.

## Task 9D QA result

Task 9D manual desktop WebView fixture QA was not performed in this run. The previous Task 9D
limitations remain:

- desktop bubble trading cards were not manually clicked through in the real WebView;
- Trading Lab fixture smoke was not manually performed;
- machine-specific performance fixture timings were not captured;
- optional live public-address QA was not performed.

## Implementation plan used

Task 9E was split into coherent checkpoints:

1. E1 - Rust-owned active-account setting.
2. E2 - Official WebSocket contract research.
3. E3+ - WebSocket transport, typed subscriptions, reconnect, reconciliation, derived trade
   episodes, sessions, UX, fixture lab, performance, and manual/live QA.

This report stops at E1 because that is the latest coherent passing checkpoint.

## E1 active-account migration

- Added SQLite schema v7 with `app_settings.active_hyperliquid_account_id`.
- The column is nullable and references `integration_accounts(id) ON DELETE SET NULL`.
- Added Rust repository functions:
  - `active_account_id`
  - `set_active_account_id`
- Added typed Tauri commands:
  - `get_active_hyperliquid_account_id`
  - `set_active_hyperliquid_account_id`
- Added sanitized native events to `main` and `bubble` windows when the active account changes.
- Updated TypeScript `AppSettings` validation with optional `activeHyperliquidAccountId`.
- Replaced the durable frontend browser-storage active-account source with async Rust-backed reads
  and writes.
- Kept a one-time migration/removal path for the old `trading-buddy.activeHyperliquidAccountId`
  browser key.
- Updated Companion Home Trading, desktop bubble cards, and BubbleView trading fact flows.
- Fixed BubbleView trading fact preflight so missing-account fact requests do not create persistent
  generation placeholders.

## Architecture choices

- Active-account selection belongs in Rust-owned SQLite because future native live-sync and
  reconstruction coordinators must not depend on a WebView-local key.
- Account deletion clears the setting through the database foreign key. Pause/disconnect preserve
  selection.
- Invalid stored IDs are repaired by clearing the setting.
- Cross-window state uses account-ID-only events. It does not broadcast raw account rows, provider
  payloads, full public addresses, journal content, or memory content.
- No live-sync preference was added in E1, avoiding a nonfunctional enabled setting.

## What was not implemented

- Official WebSocket research.
- WebSocket URL mapping or transport.
- Typed subscriptions.
- Live connection lifecycle.
- Reconnect/backoff.
- HTTP reconciliation.
- Sleep/resume handling.
- Live persistence strategy.
- Event bus for live trading facts beyond active-account selection.
- Trade-episode schema or reconstruction engine.
- Trading-session schema or grouping engine.
- Companion Home live UX.
- Desktop live awareness cards.
- Bounded reconstruction context for local Qwen.
- WebSocket fixture lab.
- Performance fixtures/timings.
- Optional live public-account QA.

## Commands run

Final E1 verification:

- `corepack pnpm format`
- `corepack pnpm check` - passed; 38 files and 136 frontend tests.
- `corepack pnpm build` - passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` - passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed; 66 Rust tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
  - passed.
- `corepack pnpm tauri build --debug --no-bundle` - passed.
- `corepack pnpm tauri build --no-bundle` - passed.
- `git diff --check` - passed.

## Files created

- `docs/qa/TASK-009E-plan.md`
- `docs/qa/TASK-009E-journal.md`
- `docs/reports/TASK-009E-live-sync-trade-reconstruction.md`
- `src/services/tradingRuntimeStore.test.ts`

## Files changed

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/TASKS.md`
- `src-tauri/src/lib.rs`
- `src-tauri/src/storage/migrations.rs`
- `src-tauri/src/storage/models.rs`
- `src-tauri/src/storage/repository.rs`
- `src-tauri/src/trading/commands.rs`
- `src-tauri/src/trading/repository.rs`
- `src/components/trading/TradingBubblePanel.tsx`
- `src/components/trading/TradingPanel.tsx`
- `src/domain/storage/types.ts`
- `src/services/tauri/tradingService.ts`
- `src/services/tradingRuntimeStore.ts`
- `src/views/BubbleView.tsx`

## Known limitations

- Native cross-window event delivery for active-account changes was not manually verified in a real
  desktop WebView session.
- The frontend test covers same-window events and legacy browser-key migration only.
- No live WebSocket capability exists yet.
- No trade reconstruction or session grouping exists yet.

## Security confirmation

E1 did not add private keys, seed phrases, exchange API secrets, wallet SDKs, signing, order
placement, order cancellation, transfers, withdrawals, position modification, generic RPC,
arbitrary HTTP URLs, arbitrary WebSocket URLs, arbitrary subscription payloads, cloud, telemetry,
screen reading, keylogging, or autonomous execution.

## Recommended next task

Proceed to Task 9E E2 only: research the current official Hyperliquid WebSocket documentation and
update `docs/integrations/HYPERLIQUID_API_CONTRACT.md` before writing any WebSocket code.
