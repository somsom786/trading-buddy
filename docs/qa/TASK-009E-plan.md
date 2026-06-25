# Task 9E QA Plan - Live sync and reconstruction foundation

**Date:** 2026-06-25  
**Project label:** Trading Buddy BETA v0.2

## Safety boundary

- Preserve strict read-only Hyperliquid behavior.
- Do not add private-key, seed-phrase, exchange-secret, signing, wallet SDK, order placement,
  order cancellation, transfers, withdrawals, position modification, generic RPC, arbitrary HTTP or
  WebSocket URLs, arbitrary subscription payloads, cloud, telemetry, screen reading, keylogging, or
  autonomous execution.
- Do not add risk judgments, behavior detection, recommendations, trade grading, automated journal
  linking, or automated trading reviews.

## Phased implementation strategy

Task 9E is large enough that work must land only at coherent passing checkpoints.

1. **E1 - Task 9D QA and Rust-owned active-account setting**
   - Record baseline validation.
   - Add Rust-owned active Hyperliquid account selection in app settings.
   - Remove browser `localStorage` as the durable source of truth.
   - Add typed commands/service methods and cross-window events.
   - Preserve selection on pause/disconnect and clear it on delete/invalid stored ID.
2. **E2 - Official WebSocket contract and connection foundation**
   - Research current official Hyperliquid WebSocket docs before implementation.
   - Document official URLs, subscriptions, message shapes, heartbeat/reconnect semantics, and
     ignored fields.
3. **E3+ - Live sync, reconciliation, reconstruction, sessions, UX, fixtures, performance**
   - Implement only after E1/E2 are stable.

This run should stop at the latest coherent passing checkpoint if the full live-sync scope cannot
be completed safely.

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

## Task 9D fixture QA gate

Attempt only what the environment permits. Do not claim WebView interactions passed unless they are
actually performed.

For this checkpoint, if real WebView automation is not performed, record Task 9D fixture QA as not
performed and carry it forward.

## E1 focused checks

- Rust migration tests for schema v7.
- Rust repository tests for selection persistence, restart, invalid stored ID, delete clearing, and
  fixture/live switching.
- Frontend tests for active-account service event propagation and old local-browser value cleanup.
- Existing trading panel and bubble checks through `pnpm check`.

## Final handoff rule

If stopping at E1, document that WebSocket, reconciliation, trade reconstruction, session
reconstruction, fixture live lab, performance timings, and live public-account QA remain
unimplemented.
