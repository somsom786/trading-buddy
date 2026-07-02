# Task 12E — Operational DeepSeek V4 Pro switch

**Date:** July 2, 2026

**Status:** Complete

## Outcome

Trading Buddy's visible companion conversation now uses
`deepseek-ai/deepseek-v4-pro` through NVIDIA's hosted OpenAI-compatible endpoint. This replaces the
catalog-visible V4 Flash route that repeatedly accepted authentication but returned no generation
response within 90–180 seconds.

## What changed

- Changed the Rust-owned provider model and generated runtime configuration from V4 Flash to V4
  Pro.
- Disabled model thinking in the provider request, matching NVIDIA's V4 Pro request shape.
- Updated the project-owned frontend model identity and cloud disclosure.
- Updated README, Vision, Product, MVP, Architecture, and Decisions documentation.
- Kept credential loading unchanged: the private key remains ignored, native-only, and absent from
  Git, generated YAML, SQLite, frontend state, diagnostics, and logs.

## Live evidence

Direct API check with the updated private credential:

- Authenticated catalog: HTTP 200 in 186 ms.
- V4 Flash: timed out after 90 seconds.
- V4 Pro: first stream event in 888 ms and completed in 1.8 seconds.

Full application path after the switch:

- Private gateway ready: 331 ms.
- Session created: 175 ms.
- Prompt accepted: under 1 ms.
- First visible token: 5,888 ms.
- Completed response: 8,899 ms.

The full path includes Trading Buddy's system/context construction and backend/session runtime, so
it is the representative application measurement.

## Verification

- Real ignored-by-default NVIDIA app-path integration test — passed.
- `pnpm format:check` — passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 183 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 99 passed, one live-network test ignored by
  default.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
  — passed.
- `pnpm tauri build --no-bundle` — passed.

## Known limitations

- The direct and full-app tests used short bounded prompts, not a long real user conversation.
- A first-token timeout/circuit breaker is still recommended before production distribution.
- Interactive Bubble stop/retry and visual lifecycle QA against a longer V4 Pro stream remains
  manual.
- API credentials still need operating-system credential storage before production distribution.

## Recommended next task

Run the Bubble's exact send → stream → stop → retry walkthrough with V4 Pro, then add a bounded
first-token timeout that fails visibly without automatically duplicating the user's message.
