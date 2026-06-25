# Task 9D QA Plan - Desktop trading awareness

**Date:** 2026-06-25  
**Project label:** Trading Buddy BETA v0.2  
**Scope:** Desktop read-only Hyperliquid facts, active account selection, bounded context, fixture QA,
and performance documentation.

## Safety boundary

- Keep Hyperliquid strictly read-only.
- Do not add private-key, seed-phrase, API-secret, signing, wallet SDK, order placement, order
  cancellation, withdrawal, transfer, arbitrary RPC, arbitrary URL, cloud, telemetry, screen
  reading, keylogging, or autonomous tool execution paths.
- React must continue using narrow typed Tauri commands and runtime guards.

## Baseline commands

Run before implementation:

1. `corepack pnpm check`
2. `corepack pnpm build`
3. `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
4. `cargo test --manifest-path src-tauri/Cargo.toml`
5. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
6. `corepack pnpm tauri build --debug --no-bundle`
7. `corepack pnpm tauri build --no-bundle`
8. `git diff --check`

## Checkpoints

### D1 - Baseline and Task 9C smoke

- Inspect repository, docs, Task 9B/9C reports, trading native code, Trading Lab, TradingPanel,
  BubbleView, ChatWorkspace, local AI, and companion services.
- Record baseline results.
- Attempt manual/desktop fixture smoke where the environment allows.

### D2 - Shared state and active account

- Add deterministic active account selection helpers.
- Persist selected account locally.
- Let Companion Home and bubble read/write the same selection.
- Clear or repair selection when the selected account is deleted.

### D3 - Desktop trading cards and sync controls

- Add compact bubble trading actions.
- Add account, positions, fills, funding, open orders, and sync cards.
- Refresh/cancel only the selected account.
- Keep cards bounded and read-only.

### D4 - Trading intents and context builder

- Complete deterministic trading intent routing.
- Add deterministic execution refusal.
- Add bounded context builder with labels, freshness, fixture/read-only warnings, no full address,
  no raw JSON, and strict character budget.

### D5 - Local-Qwen and facts-only behavior

- Inject bounded context only for relevant trading intents.
- Keep structured cards useful without Ollama.
- Ensure execution requests bypass model calls.
- Ensure trading data does not create memory or journal proposals automatically.

### D6 - Trading Lab and performance

- Expand Trading Lab scenario controls and context preview.
- Run performance scenarios and record machine-specific results.

### D7 - Documentation and final validation

- Update README/product/MVP/architecture/decisions/tasks/progress.
- Create `docs/reports/TASK-009D-desktop-trading-awareness.md`.
- Run full validation and push a coherent checkpoint.

## Manual QA truthfulness

Do not mark desktop WebView steps as passed unless actually performed. If UI automation cannot
drive a step, record it as not performed.
