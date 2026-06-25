# Task 9D - Desktop trading awareness and bounded context

**Date:** 2026-06-25  
**Project label:** Trading Buddy BETA v0.2  
**Status:** Implementation checkpoint complete; manual desktop QA remains pending.

## What changed

- Added shared active Hyperliquid account selection between Companion Home and the desktop bubble.
- Added compact desktop bubble trading cards for saved account facts, current positions, recent
  fills, funding records, open orders, and sync progress.
- Added selected-account refresh and cancel-sync controls using the existing read-only native
  commands.
- Added deterministic trading intents for account facts, positions, fills, funding, open orders,
  refresh, cancel sync, opening Trading Home, and unsupported execution requests.
- Added deterministic model-free refusal for place/close/cancel/modify trade requests.
- Added a bounded local-model trading context builder from saved read-only facts only.
- Added exact decimal-string summing for funding totals without binary floating-point arithmetic.
- Updated BubbleView so trading fact requests do not create automatic memory or journal proposals.
- Added Trading Lab bounded-context preview controls.
- Updated README, product, MVP, architecture, decisions, tasks, progress, QA plan, and QA journal.

## Architecture choices

- Desktop trading awareness is frontend-only and reads from the existing narrow Tauri trading
  service. No new native write capability was added.
- Active account selection is stored in local browser storage with a small typed service and
  same-window/storage events, keeping UI components away from direct storage details.
- The context builder lives in `src/domain/trading/` and accepts already-loaded facts, so it is
  deterministic, framework-independent, and testable.
- Trading facts passed to the local model are bounded by count and character budget, labelled as
  read-only/saved/exchange-reported, and exclude full public addresses, raw provider JSON, and
  internal row IDs.
- Execution-like requests bypass model generation and receive a deterministic refusal.

## Safety boundary

This task did not add:

- private keys, seed phrases, wallet SDKs, signing, agent approval, exchange API secrets, or auth;
- order placement, order cancellation, transfers, withdrawals, position modification, or generic
  execution methods;
- arbitrary URLs, generic RPC, generic HTTP proxying, WebSocket live sync, cloud, telemetry,
  keylogging, screen reading, or autonomous trading.

## Commands run

Baseline before implementation:

- `corepack pnpm check` - passed; 124 frontend tests.
- `corepack pnpm build` - passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` - passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed; 63 Rust tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed.
- `corepack pnpm tauri build --debug --no-bundle` - passed.
- `corepack pnpm tauri build --no-bundle` - passed.
- `git diff --check` - passed.

Final verification:

- `corepack pnpm format` - passed.
- `corepack pnpm check` - passed; 37 test files and 132 frontend tests.
- `corepack pnpm build` - passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` - passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed; 63 Rust tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed.
- `corepack pnpm tauri build --debug --no-bundle` - passed.
- `corepack pnpm tauri build --no-bundle` - passed.
- `git diff --check` - passed.

## Files created

- `docs/qa/TASK-009D-plan.md`
- `docs/qa/TASK-009D-journal.md`
- `docs/reports/TASK-009D-desktop-trading-awareness.md`
- `src/components/trading/TradingBubblePanel.tsx`
- `src/domain/trading/context.ts`
- `src/domain/trading/context.test.ts`
- `src/domain/trading/decimal.ts`
- `src/domain/trading/runtime.ts`
- `src/domain/trading/runtime.test.ts`
- `src/services/tradingFacts.ts`
- `src/services/tradingRuntimeStore.ts`

## Files changed

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MVP.md`
- `docs/PRODUCT.md`
- `docs/PROGRESS.md`
- `docs/TASKS.md`
- `src/components/local-ai/TradingLab.tsx`
- `src/components/trading/TradingPanel.tsx`
- `src/domain/trading/formatting.ts`
- `src/domain/trading/formatting.test.ts`
- `src/domain/trading/intents.ts`
- `src/styles.css`
- `src/views/BubbleView.tsx`

## What could not be verified

- Real WebView click-through of the new desktop bubble trading cards.
- Real WebView Trading Lab fixture smoke for create/sync/cancel/performance scenarios.
- Machine-specific performance timing capture in the real desktop app.
- Optional live public-address QA, because no explicit public test address was supplied.

## Known limitations

- Hyperliquid awareness remains user-triggered saved-state awareness, not live WebSocket
  monitoring.
- The desktop bubble shows bounded recent facts and does not chart, reconstruct trades, score risk,
  detect behavior, or recommend trades.
- The selected-account store is local UI state; durable trading records remain in Rust-owned
  SQLite.
- Local-model responses still need user judgment. The app labels saved facts and enforces read-only
  refusal, but it is not financial advice.

## Recommended next task

Run a direct human desktop QA pass for Task 9D:

1. Create each fixture scenario in Trading Lab.
2. Select fixture accounts in Companion Home and verify the bubble cards update.
3. Refresh and cancel sync from the bubble.
4. Ask local-Qwen account/position/fill/funding/order questions and confirm the response uses
   bounded saved facts only.
5. Record performance fixture timings and update the QA journal.
